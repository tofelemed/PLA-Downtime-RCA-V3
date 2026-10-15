import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { holdsAnyRoleOnUnit } from '../../auth/roles/unit-roles';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import {
  StopForVerification,
  validateRefusal,
  verifyRefusal,
} from '../../domain/events/coding-verification';
import {
  periodInScope,
  requireUser,
} from '../../reconciliation/revision-access';
import { FAILURE_VALIDATORS, STOP_VERIFIERS } from './verification-roles';

/** At most this many stops per call (a shift has far fewer). */
export const VERIFY_LIMIT = 1000;

export interface VerificationSkip {
  eventId: string;
  /** NOT_FOUND, NOT_AUTHORIZED, NOT_A_STOP, NOT_CODED, ALREADY_VERIFIED, OWN_CODING, NO_FAILURE_DETAIL, … */
  reason: string;
}

export interface VerificationOutcome {
  /** the events this call verified (or validated), in id order */
  done: string[];
  skipped: VerificationSkip[];
  at: string;
}

interface StopRow {
  id: string;
  unit_id: string;
  site_id: string | null;
  is_stop: boolean;
  reason_code_id: string | null;
  investigation_pending: boolean;
  verified_at: Date | null;
  validated_at: Date | null;
  has_failure_detail: boolean;
  coded_by: string | null;
}

/** Stops of the acting tenant (and unit scope), locked, with who entered their current coding. */
const STOPS_SQL = `SELECT e."id", e."unit_id", n."site_id",
       (e."physical_type" = 'downtime' AND e."physical_state" IN ('open', 'closed')) AS "is_stop",
       e."reason_code_id", e."investigation_pending", e."verified_at", e."validated_at",
       (e."failure_mode" IS NOT NULL OR e."failure_severity" IS NOT NULL OR e."maintainable_item" IS NOT NULL
        OR e."failure_mechanism" IS NOT NULL OR e."failure_cause" IS NOT NULL) AS "has_failure_detail",
       c."author_id"::text AS "coded_by"
  FROM "production_events" e
  JOIN "units" n ON n."id" = e."unit_id"
  LEFT JOIN "event_coding" c ON c."event_id" = e."id" AND c."revision" = e."current_coding_revision"
 WHERE e."tenant_id" = $1 AND e."id" = ANY($2::uuid[]) AND ($3::uuid[] IS NULL OR e."unit_id" = ANY($3::uuid[]))
 ORDER BY e."id"
   FOR UPDATE OF e`;

/** Unverified stops of a shift period (IDX_production_events_unverified_stops). */
const PERIOD_STOPS_SQL = `SELECT e."id" FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."physical_type" = 'downtime' AND e."verified_at" IS NULL
   AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY e."start_time", e."id"
 LIMIT ${VERIFY_LIMIT + 1}`;

const toStop = (row: StopRow): StopForVerification => ({
  isStop: row.is_stop,
  reasonCodeId: row.reason_code_id,
  investigationPending: row.investigation_pending,
  verifiedAt: row.verified_at,
  validatedAt: row.validated_at,
  hasFailureDetail: row.has_failure_detail,
  codedBy: row.coded_by,
});

type Stage = 'verify' | 'validate';

const STAGES: Readonly<
  Record<
    Stage,
    {
      roles: readonly string[];
      refusal: (stop: StopForVerification, actor: string) => string | null;
      set: string;
    }
  >
> = {
  verify: {
    roles: STOP_VERIFIERS,
    refusal: verifyRefusal,
    set: `"verified_by" = $2, "verified_at" = $3`,
  },
  validate: {
    roles: FAILURE_VALIDATORS,
    refusal: validateRefusal,
    set: `"validated_by" = $2, "validated_at" = $3`,
  },
};

/** Why one stop is skipped (null = it qualifies): unknown or out of scope, no role on its unit, the rules. */
function skipReason(
  row: StopRow | undefined,
  by: { context: RequestContext; actor: string; stage: (typeof STAGES)[Stage] },
): string | null {
  if (!row) return 'NOT_FOUND';
  const unit = { id: row.unit_id, siteId: row.site_id };
  if (!holdsAnyRoleOnUnit(by.context, unit, by.stage.roles)) {
    return 'NOT_AUTHORIZED';
  }
  return by.stage.refusal(toStop(row), by.actor);
}

/**
 * SME D13 staged verification of stop coding: a supervisor of the stop's unit verifies its coding (one stop,
 * a selection, or every unverified stop of a shift period), maintenance validates the failure detail of a
 * verified stop. Never the person who entered the current coding; stops that do not qualify are skipped with
 * the reason, so a bulk verification never fails as a whole and recording is never blocked. A later change
 * of the coding / failure detail clears the label (`verificationReset`).
 */
@Injectable()
export class StopVerificationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  verify(
    context: RequestContext,
    input: { eventIds?: string[]; periodId?: string },
  ): Promise<VerificationOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const ids = await this.targets(manager, context, input);
      return this.apply(manager, context, { ids, stage: 'verify' });
    });
  }

  validate(
    context: RequestContext,
    eventId: string,
  ): Promise<VerificationOutcome> {
    return this.dataSource.transaction((manager) =>
      this.apply(manager, context, { ids: [eventId], stage: 'validate' }),
    );
  }

  private async targets(
    manager: EntityManager,
    context: RequestContext,
    input: { eventIds?: string[]; periodId?: string },
  ): Promise<string[]> {
    if ((input.eventIds === undefined) === (input.periodId === undefined)) {
      throw new UnprocessableEntityException({
        code: 'SELECTION_REQUIRED',
        message: 'name either eventIds or periodId',
      });
    }
    if (input.eventIds) return [...new Set(input.eventIds)];
    const period = await periodInScope(
      manager,
      context,
      input.periodId as string,
    );
    const rows: Array<{ id: string }> = await manager.query(PERIOD_STOPS_SQL, [
      period.tenantId,
      period.unitId,
      period.utcStart,
      period.utcEnd,
    ]);
    if (rows.length > VERIFY_LIMIT) {
      throw new UnprocessableEntityException({
        code: 'SELECTION_TOO_LARGE',
        message: `more than ${VERIFY_LIMIT} unverified stops`,
      });
    }
    return rows.map((r) => r.id);
  }

  private async apply(
    manager: EntityManager,
    context: RequestContext,
    work: { ids: string[]; stage: Stage },
  ): Promise<VerificationOutcome> {
    const actor = requireUser(context);
    const tenantId = requireTenantId(context);
    const stage = STAGES[work.stage];
    const rows: StopRow[] = work.ids.length
      ? await manager.query(STOPS_SQL, [
          tenantId,
          work.ids,
          restrictedUnitIds(context, tenantId),
        ])
      : [];
    const found = new Map(rows.map((r) => [r.id, r]));
    const done: string[] = [];
    const skipped: VerificationSkip[] = [];
    for (const id of [...work.ids].sort()) {
      const reason = skipReason(found.get(id), { context, actor, stage });
      if (reason) skipped.push({ eventId: id, reason });
      else done.push(id);
    }
    const at = new Date();
    if (done.length > 0) {
      await manager.query(
        `UPDATE "production_events" SET ${stage.set}, "row_version" = "row_version" + 1
          WHERE "tenant_id" = $4 AND "id" = ANY($1::uuid[])`,
        [done, actor, at, tenantId],
      );
    }
    return { done, skipped, at: at.toISOString() };
  }
}
