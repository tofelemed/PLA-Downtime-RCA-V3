import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  AuthorityRole,
  AuthorityTransition,
  authorityTransitions,
  newTransitions,
  roleOf,
  RunSlice,
} from '../domain/actuals/period/authority-transitions';
import {
  PeriodFinding,
  SourceSubstitution,
} from '../domain/actuals/period/period-actuals.types';
import {
  insertNotifications,
  NotificationRow,
  periodDetail,
  PeriodRef,
} from '../notifications/notification-rows';
import { roleHoldersOf } from '../notifications/role-holders';
import { ProductionPeriod } from './entities/production-period.entity';

/** Outbox message types of the plan 1.10 step 5 fallback banner (SRC01). */
export const SOURCE_FALLBACK_ACTIVATED = 'SourceFallbackActivated';
export const SOURCE_FALLBACK_ENDED = 'SourceFallbackEnded';

/** Who is told: production accounting (the actuals' owner) and integration (the source's owner). */
const ADDRESSEES = ['production_accountant', 'integration_admin'] as const;

interface ResultRow {
  slice_id: string;
  product_id: string;
  window_from: Date;
  gross: string | null;
  good: string | null;
  substitution: SourceSubstitution | null;
  exceptions: PeriodFinding[];
}

/** Slices of an actuals run with what the authority role reads. Uses the run index of `actuals_results`. */
async function runSlices(
  manager: EntityManager,
  runId: string | null,
): Promise<RunSlice[]> {
  if (!runId) return [];
  const rows: ResultRow[] = await manager.query(
    `SELECT r."slice_id", s."product_id", s."window_from", r."gross"::text AS "gross", r."good"::text AS "good",
            r."substitution", r."exceptions"
       FROM "actuals_results" r JOIN "period_product_slices" s ON s."id" = r."slice_id"
      WHERE r."actuals_run_id" = $1`,
    [runId],
  );
  return rows.map((r) => ({
    sliceId: r.slice_id,
    productId: r.product_id,
    start: new Date(r.window_from),
    actuals: {
      substitution: r.substitution,
      gross: r.gross,
      good: r.good,
      findings: r.exceptions ?? [],
    },
  }));
}

/**
 * Each product's role at the end of the unit's preceding period (its last slice with data there); the
 * period ending at this one's start is found through the unit's period exclusion index (gist on the range).
 */
async function precedingRoles(
  manager: EntityManager,
  period: ProductionPeriod,
): Promise<Map<string, AuthorityRole>> {
  const [previous]: Array<{ run_id: string | null }> = await manager.query(
    `SELECT p."current_actuals_run_id" AS "run_id" FROM "production_periods" p
      WHERE p."tenant_id" = $1 AND p."unit_id" = $2 AND p."utc_end" = $3
        AND tstzrange(p."utc_start", p."utc_end", '[)') && tstzrange($3::timestamptz - interval '1 second', $3::timestamptz, '[)')
      LIMIT 1`,
    [period.tenantId, period.unitId, period.utcStart],
  );
  const roles = new Map<string, AuthorityRole>();
  const slices = await runSlices(manager, previous?.run_id ?? null);
  for (const slice of slices.sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )) {
    const role = roleOf(slice.actuals);
    if (role.role !== 'none') roles.set(slice.productId, role);
  }
  return roles;
}

async function periodRef(
  manager: EntityManager,
  periodId: string,
): Promise<PeriodRef | null> {
  const [row]: PeriodRef[] = await manager.query(
    `SELECT p."id", p."unit_id", u."name" AS "unit_name", pv."plan_id"::text AS "plan_id",
            to_char(p."local_date", 'YYYY-MM-DD') AS "local_date", p."shift_name"
       FROM "production_periods" p LEFT JOIN "units" u ON u."id" = p."unit_id"
       LEFT JOIN "plan_versions" pv ON pv."id" = p."selected_plan_version_id"
      WHERE p."id" = $1`,
    [periodId],
  );
  return row ?? null;
}

async function notify(
  manager: EntityManager,
  period: ProductionPeriod,
  transitions: readonly AuthorityTransition[],
): Promise<void> {
  const ref = await periodRef(manager, period.id);
  if (!ref) return;
  const users = new Set<string>();
  for (const role of ADDRESSEES) {
    const holders = await roleHoldersOf(manager, {
      tenantId: period.tenantId,
      role,
      unitId: period.unitId,
    });
    holders.forEach((id) => users.add(id));
  }
  const rows: NotificationRow[] = [...users].flatMap((userId) =>
    transitions.map((t) => ({
      user_id: userId,
      kind: 'source_fallback' as const,
      dedupe_key: `source-fallback:${t.sliceId}:${t.kind}:${t.used?.rank ?? ''}:${t.used?.source ?? ''}`,
      entity_id: period.id,
      detail: { ...periodDetail(ref), ...t },
    })),
  );
  await insertNotifications(manager, period.tenantId, rows);
}

/**
 * Plan 1.10 step 5 (SRC01 fallback banner): after an actuals run is written, the products whose authority
 * moved to a substitute (`SourceFallbackActivated`) or back to the top-ranked source
 * (`SourceFallbackEnded`, with the run's `source_conflict` when both quantified the window: the primary is
 * kept, the conflict logged) are published once — against the unit's preceding period, and only what the
 * superseded run of the period did not already say — and production accounting and integration of the
 * unit get an in-app notification (one per user, slice and transition).
 */
export async function recordAuthorityTransitions(
  manager: EntityManager,
  input: {
    period: ProductionPeriod;
    runId: string;
    supersededRunId: string | null;
  },
): Promise<void> {
  const { period } = input;
  const preceding = await precedingRoles(manager, period);
  const current = authorityTransitions(
    preceding,
    await runSlices(manager, input.runId),
  );
  const before = authorityTransitions(
    preceding,
    await runSlices(manager, input.supersededRunId),
  );
  const fresh = newTransitions(current, before);
  if (fresh.length === 0) return;
  await enqueueOutbox(
    manager,
    fresh.map((t) => ({
      tenantId: period.tenantId,
      aggregateType: 'production_period',
      aggregateId: period.id,
      type:
        t.kind === 'activated'
          ? SOURCE_FALLBACK_ACTIVATED
          : SOURCE_FALLBACK_ENDED,
      payload: {
        periodId: period.id,
        unitId: period.unitId,
        actualsRunId: input.runId,
        ...t,
      },
    })),
  );
  await notify(manager, period, fresh);
}
