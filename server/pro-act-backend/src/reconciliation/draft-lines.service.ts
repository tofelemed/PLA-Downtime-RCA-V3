import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { LossLine } from '../accounting/entities/loss-line.entity';
import { assertRevision, staleRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { formatDec } from '../domain/actuals/decimal';
import { DecisionLine } from '../domain/reconciliation/reconciliation.types';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import {
  invalidReference,
  invalidTransition,
} from '../profiles/profile-errors';
import { DraftLinesCommand } from './draft-line.input';
import { LineEvidenceRef } from './entities/reconciliation-line.entity';
import { checkReferences } from './line-references';
import { LineDraft, LineSetWriter } from './line-set.writer';
import { shapeLines, ShapedLine } from './line-shape';
import {
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import {
  candidatesOf,
  loadRevisionState,
  RevisionState,
} from './revision-state';
import { contentHashOf } from './reviewed-content';
import { saveIssues } from './save-issues';
import { runChanged, workflowIssues } from './workflow-errors';
import { actorOf, recordTransition } from './workflow-recorder';
import { satisfiesRole } from '../auth/roles/role-model';
import { BRIDGE_WRITERS } from '../v2/periods/period-roles';
import { assertManualLineRules } from './line-evidence-rules';
import { checkReversals } from './reversal-references';
import { assertBridgesWithinLimit } from './bridge-review';

/**
 * The atomic draft-lines command of §15.3 (plan 2.8 step 2): in one transaction, serialized with the
 * period's calculation runs — the revision is the period's draft, the editor saw the current run (else 409
 * RUN_CHANGED with the candidate diff) and the revision is unchanged since it was read (If-Match, 412),
 * every line passes
 * the shape, reference and allocation-budget rules (422 with the line index and the remaining allocation),
 * then the full set of decisions and manual lines is written as a new immutable set and the revision
 * points at it. Totals are recomputed from the same run (no new run); the save is audited.
 */
@Injectable()
export class DraftLinesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly writer: LineSetWriter,
  ) {}

  save(
    context: RequestContext,
    periodId: string,
    expectedVersion: number,
    command: DraftLinesCommand,
  ): Promise<AccountingRevision> {
    const actorId = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const state = await this.draftState(manager, context, periodId, command);
      await assertBaseRun(manager, state, command.baseRunId);
      assertRevision(state.revision.rowVersion, expectedVersion);
      const lines = await this.resolve(manager, state, command, {
        actorId,
        mayBridge: BRIDGE_WRITERS.some((role) =>
          satisfiesRole(context.roles, role),
        ),
      });
      const set = await this.writer.write(manager, {
        revision: state.revision,
        baseRunId: command.baseRunId,
        origin: 'draft_save',
        lines,
        actorId,
      });
      await movePointer(manager, state.revision, set.id, actorId);
      await this.audit(manager, context, state, set.id);
      return manager.findOneByOrFail(AccountingRevision, {
        id: state.revision.id,
      });
    });
  }

  /** The numbered draft of a period in scope, locked with the period's runs, and its state. */
  private async draftState(
    manager: EntityManager,
    context: RequestContext,
    periodId: string,
    command: DraftLinesCommand,
  ): Promise<RevisionState> {
    const period = await periodInScope(manager, context, periodId);
    await lockPeriod(manager, period.id);
    const revision = await revisionNumbered(
      manager,
      period.id,
      command.revision,
    );
    if (revision.lifecycle !== 'draft') {
      throw invalidTransition(
        'accounting revision',
        revision.lifecycle,
        'edited',
      );
    }
    return loadRevisionState(manager, period, revision, this.policies);
  }

  /** `approval_actions` + `audit_log` with the content hash before and after the save. */
  private async audit(
    manager: EntityManager,
    context: RequestContext,
    before: RevisionState,
    lineSetId: string,
  ): Promise<void> {
    const after = await loadRevisionState(
      manager,
      before.period,
      { ...before.revision, currentLineSetId: lineSetId },
      this.policies,
    );
    await recordTransition(manager, {
      revision: before.revision,
      action: 'save_draft',
      from: 'draft',
      to: 'draft',
      actor: actorOf(context),
      beforeHash: contentHashOf(before),
      afterHash: contentHashOf(after),
      detail: { lineSetId, lines: after.lines.length },
    });
  }

  /** Shape, references and allocation budget; returns the rows to write. */
  private async resolve(
    manager: EntityManager,
    state: RevisionState,
    command: DraftLinesCommand,
    caller: { actorId: string; mayBridge: boolean },
  ): Promise<LineDraft[]> {
    const { actorId } = caller;
    const shaped = shapeLines(
      command.lines,
      state.candidateLines,
      state.tolerance.rule,
    );
    command.lines.forEach((input, index) =>
      assertManualLineRules(input, index, { mayBridge: caller.mayBridge }),
    );
    const evidence = await checkReferences(manager, state.period, shaped);
    await checkReversals(manager, state, shaped);
    assertBridgesWithinLimit(state, shaped);
    const decisions = shaped.map(decisionOf);
    const issues = saveIssues(state, shaped, decisions);
    if (issues.length > 0) throw workflowIssues(issues);
    return shaped.map((line, i) => rowOf(line, evidence[i], actorId));
  }
}

function decisionOf(line: ShapedLine): DecisionLine {
  return {
    action: line.input.action,
    autoKey: line.input.autoKey ?? null,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: line.quantity,
    baseQuantity: line.candidate
      ? candidatesOf([line.candidate])[0].quantity
      : null,
    missingCode: line.input.missingCode === true,
  };
}

function rowOf(
  line: ShapedLine,
  evidence: LineEvidenceRef[],
  actorId: string,
): LineDraft {
  const { input, candidate } = line;
  return {
    action: input.action,
    autoKey: input.autoKey ?? null,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: line.quantity ? formatDec(line.quantity) : null,
    baseQuantity: candidate
      ? formatDec(candidatesOf([candidate])[0].quantity)
      : null,
    uom: candidate?.uom ?? null,
    basis: input.basis ?? candidate?.basis ?? null,
    reasonCodeId: input.reasonCodeId ?? candidate?.reasonCodeId ?? null,
    impactCodeId: input.impactCodeId ?? candidate?.impactCodeId ?? null,
    evidence,
    adjustmentId: input.adjustmentId ?? null,
    missingCode: input.missingCode === true,
    missingEvent: input.missingEvent === true,
    classification: input.classification ?? null,
    evidenceType: input.evidenceType ?? null,
    evidenceRef: input.evidenceRef?.trim() || null,
    reversesLineId: input.reversesLineId ?? null,
    reason: input.reason?.trim() || null,
    comment: input.comment ?? null,
    authorId: actorId,
  };
}

/** The run the editor saw must be a run of this revision (422) and the current one (409 + diff). */
async function assertBaseRun(
  manager: EntityManager,
  state: RevisionState,
  baseRunId: string,
): Promise<void> {
  if (state.run?.id === baseRunId) return;
  const base = await manager.findOneBy(CalculationRun, {
    id: baseRunId,
    revisionId: state.revision.id,
  });
  if (!base)
    throw invalidReference('baseRunId', 'calculation run of the revision');
  const before = await manager.find(LossLine, {
    where: { runId: base.id, ledger: 'plan', source: 'auto' },
    select: { autoKey: true, quantity: true, kind: true },
  });
  throw runChanged({
    currentRunId: state.run?.id ?? null,
    ...candidateDiff(before, state.candidateLines),
  });
}

/** Candidates added, removed or changed between the base run and the current run. */
function candidateDiff(
  before: readonly LossLine[],
  after: readonly LossLine[],
) {
  const key = (l: LossLine) => l.autoKey ?? l.id;
  const old = new Map(
    before.filter((l) => l.kind !== 'residual').map((l) => [key(l), l]),
  );
  const now = new Map(after.map((l) => [key(l), l]));
  const quantity = (l: LossLine) => formatDec(candidatesOf([l])[0].quantity);
  return {
    added: [...now.keys()].filter((k) => !old.has(k)),
    removed: [...old.keys()].filter((k) => !now.has(k)),
    changed: [...now.entries()]
      .filter(
        ([k, l]) =>
          old.has(k) && quantity(old.get(k) as LossLine) !== quantity(l),
      )
      .map(([k, l]) => ({
        autoKey: k,
        before: quantity(old.get(k) as LossLine),
        after: quantity(l),
      })),
  };
}

/** Moves the revision to the new set; 412 if the row changed meanwhile (bumps the row version). */
async function movePointer(
  manager: EntityManager,
  revision: AccountingRevision,
  lineSetId: string,
  actorId: string,
): Promise<void> {
  const result = await manager.update(
    AccountingRevision,
    { id: revision.id, rowVersion: revision.rowVersion },
    { currentLineSetId: lineSetId, updatedBy: actorId },
  );
  if (!result.affected) throw staleRevision();
}
