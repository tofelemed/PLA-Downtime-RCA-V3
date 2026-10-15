import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  pairKey,
  planReconciliation,
  ReconciliationPair,
} from '../domain/events/stop-reconciliation';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { SYSTEM_ACTOR } from '../production-event/revisions/revision-actor';
import { UnitScope } from './derived-stop-writer';
import { mergeDuplicate } from './duplicate-merge';
import { StopReconciliation } from './entities/stop-reconciliation.entity';
import { loadReconcilableStops } from './reconcilable-stops.loader';
import { StopEventSettingsService } from './stop-event-settings.service';

export interface ReconcileWindow {
  start: Date;
  /** null = up to now */
  end: Date | null;
}

interface RunContext {
  scope: UnitScope;
  tolerance: number;
  autoMerge: boolean;
  policyVersionId: string | null;
}

const DECIDED = new Set(['rejected', 'undone']);
/** look-back for stops already open before the window: a duplicate's start may lie before it */
const OVERLAP_MARGIN_MS = 3_600_000;

/**
 * DT-04 / SME D5 duplicate handling run by the worker after state-derived writes and after manual / source
 * changes (plan 1.10 SRC02): pairs the unit's live stops in the window (`planReconciliation`), merges the
 * automatic pairs when the policy allows (`autoMergeDuplicates`), records the rest as suggestions, and
 * expires suggestions that no longer match. Idempotent: rejected / undone pairs are never proposed again,
 * merged evidence is no longer live, and an unchanged suggestion is left as it is.
 */
@Injectable()
export class StopReconciliationService {
  constructor(private readonly settings: StopEventSettingsService) {}

  async reconcileUnit(
    manager: EntityManager,
    scope: UnitScope,
    window: ReconcileWindow,
    now: Date,
  ): Promise<EventChangeMessage[]> {
    const { settings, policyVersionId } = await this.settings.resolve(
      manager,
      scope,
      now,
    );
    const tolerance = settings.duplicateToleranceSeconds;
    const stops = await loadReconcilableStops(manager, scope, {
      start: new Date(
        window.start.getTime() - OVERLAP_MARGIN_MS - tolerance * 1000,
      ),
      end: new Date((window.end ?? now).getTime() + tolerance * 1000),
    });
    if (stops.length < 2) return [];
    const ids = stops.map((s) => s.id);
    const rows = await manager.getRepository(StopReconciliation).find({
      where: [
        { tenantId: scope.tenantId, keptEventId: In(ids) },
        { tenantId: scope.tenantId, evidenceEventId: In(ids) },
      ],
    });
    const blocked = new Set(
      rows
        .filter((r) => DECIDED.has(r.state))
        .map((r) => pairKey(r.keptEventId, r.evidenceEventId)),
    );
    const pairs = planReconciliation(stops, {
      toleranceSeconds: tolerance,
      blocked,
    });
    const run: RunContext = {
      scope,
      tolerance,
      autoMerge: settings.autoMergeDuplicates,
      policyVersionId,
    };
    const byPair = new Map(
      rows.map((r) => [pairKey(r.keptEventId, r.evidenceEventId), r]),
    );
    const messages: EventChangeMessage[] = [];
    for (const pair of pairs) {
      const row = byPair.get(pairKey(pair.keptId, pair.evidenceId)) ?? null;
      messages.push(...(await this.applyPair(manager, run, pair, row)));
    }
    const loaded = new Set(ids);
    await this.expireStale(
      manager,
      rows.filter(
        (r) => loaded.has(r.keptEventId) && loaded.has(r.evidenceEventId),
      ),
      new Set(pairs.map((p) => pairKey(p.keptId, p.evidenceId))),
    );
    return messages;
  }

  private async applyPair(
    manager: EntityManager,
    run: RunContext,
    pair: ReconciliationPair,
    row: StopReconciliation | null,
  ): Promise<EventChangeMessage[]> {
    if (pair.mode === 'auto' && run.autoMerge) {
      const outcome = await mergeDuplicate(manager, pair, {
        actor: SYSTEM_ACTOR,
        reason: `duplicate stop merged automatically (start within ${run.tolerance} s)`,
      });
      if (!outcome) return [];
      await this.save(manager, run, pair, row, {
        state: 'merged',
        mode: 'auto',
        copied: outcome.copied,
        evidenceOccurrenceId: outcome.evidenceOccurrenceId,
        decidedAt: new Date(),
      });
      return outcome.messages;
    }
    if (row?.state === 'merged') return [];
    await this.save(manager, run, pair, row, { state: 'suggested' });
    return [];
  }

  private async save(
    manager: EntityManager,
    run: RunContext,
    pair: ReconciliationPair,
    row: StopReconciliation | null,
    change: Partial<StopReconciliation>,
  ): Promise<void> {
    const repository = manager.getRepository(StopReconciliation);
    const values: Partial<StopReconciliation> = {
      tenantId: run.scope.tenantId,
      unitId: run.scope.unitId,
      keptEventId: pair.keptId,
      evidenceEventId: pair.evidenceId,
      mode: 'auto',
      suggestionReason: pair.suggestionReason,
      startDeltaSeconds: pair.startDeltaSeconds,
      endDeltaSeconds: pair.endDeltaSeconds,
      toleranceSeconds: run.tolerance,
      conflicts: pair.conflicts,
      copied: pair.copied,
      policyVersionId: run.policyVersionId,
      ...change,
    };
    if (row && unchanged(row, values)) return;
    await repository.save(
      row ? repository.merge(row, values) : repository.create(values),
    );
  }

  /** Open suggestions whose pair no longer matches (times or causes changed) become `expired`. */
  private async expireStale(
    manager: EntityManager,
    rows: readonly StopReconciliation[],
    current: ReadonlySet<string>,
  ): Promise<void> {
    const stale = rows.filter(
      (r) =>
        r.state === 'suggested' &&
        !current.has(pairKey(r.keptEventId, r.evidenceEventId)),
    );
    if (stale.length === 0) return;
    await manager
      .getRepository(StopReconciliation)
      .update({ id: In(stale.map((r) => r.id)) }, { state: 'expired' });
  }
}

/** A stored suggestion equal to the new one is not rewritten (no row-version churn on every run). */
function unchanged(
  row: StopReconciliation,
  values: Partial<StopReconciliation>,
): boolean {
  return (
    row.state === values.state &&
    row.suggestionReason === values.suggestionReason &&
    Number(row.startDeltaSeconds) === values.startDeltaSeconds &&
    (row.endDeltaSeconds === null ? null : Number(row.endDeltaSeconds)) ===
      values.endDeltaSeconds &&
    JSON.stringify(row.conflicts) === JSON.stringify(values.conflicts)
  );
}
