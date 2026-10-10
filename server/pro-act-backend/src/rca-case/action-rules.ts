import { EntityManager } from 'typeorm';
import { ActionBaseline } from '../domain/rca/rca-verification';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaActionV2UpdateDto } from '../v2/rca/rca-actions-v2.dto';
import { caseFootprint, footprintRecurrence } from './rca-recurrence';
import { invalidBody, invalidReference, RcaScope } from './rca-scope';

const DAY_MS = 86_400_000;

const date = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/** Columns of `rca_actions` a body sets (undefined = untouched); the baseline is resolved separately. */
export function actionColumns(
  body: RcaActionV2UpdateDto,
  now: Date,
): Partial<RcaAction> {
  const columns: Partial<RcaAction> = {};
  if (body.title !== undefined) columns.title = body.title;
  if (body.description !== undefined) columns.description = body.description;
  if (body.ownerId !== undefined) columns.ownerId = body.ownerId;
  if (body.dueDate !== undefined) columns.dueDate = date(body.dueDate) ?? null;
  if (body.status !== undefined) columns.status = body.status;
  if (body.status === 'done') columns.completedAt = now;
  if (body.completionEvidenceRef !== undefined)
    columns.completionEvidenceRef = body.completionEvidenceRef;
  if (body.verificationWindowStart !== undefined)
    columns.verificationWindowStart =
      date(body.verificationWindowStart) ?? null;
  if (body.verificationWindowEnd !== undefined)
    columns.verificationWindowEnd = date(body.verificationWindowEnd) ?? null;
  if (body.claimedAvoidedLoss !== undefined)
    columns.claimedAvoidedLoss = body.claimedAvoidedLoss;
  if (body.claimedCurrency !== undefined)
    columns.claimedCurrency = body.claimedCurrency;
  return columns;
}

/** 422 for an inconsistent action: window order, a claim without currency, a foreign owner. */
export async function assertActionConsistent(
  manager: EntityManager,
  scope: RcaScope,
  action: Partial<RcaAction>,
): Promise<void> {
  const start = action.verificationWindowStart ?? null;
  const end = action.verificationWindowEnd ?? null;
  if ((start === null) !== (end === null) || (start && end && end <= start)) {
    throw invalidBody(
      'INVALID_RANGE',
      'verificationWindowEnd',
      'the verification window needs a start before its end',
    );
  }
  if ((action.claimedAvoidedLoss ?? null) !== null && !action.claimedCurrency) {
    throw invalidBody(
      'VALIDATION_FAILED',
      'claimedCurrency',
      'a claimed avoided loss needs its currency (IRR or USD)',
    );
  }
  if (action.ownerId) {
    const rows: unknown[] = await manager.query(
      `SELECT 1 FROM "users" u WHERE u."id" = $1 AND (u."tenant_id" = $2
          OR EXISTS (SELECT 1 FROM "user_scopes" s WHERE s."user_id" = u."id" AND s."tenant_id" = $2))`,
      [action.ownerId, scope.tenantId],
    );
    if (rows.length === 0) throw invalidReference('ownerId');
  }
}

/**
 * The stored baseline: a declared value as given, otherwise counted from history over the `windowDays`
 * before the verification window (the case's linked assets / units and reasons). Needs the window.
 */
export async function resolveBaseline(
  manager: EntityManager,
  input: {
    tenantId: string;
    rcaId: string;
    baseline: {
      metric: ActionBaseline['metric'];
      windowDays: number;
      value?: string;
    };
    windowStart: Date | null;
  },
): Promise<ActionBaseline> {
  const { baseline } = input;
  if (baseline.value !== undefined) {
    return {
      metric: baseline.metric,
      windowDays: baseline.windowDays,
      value: baseline.value,
      declared: true,
    };
  }
  if (!input.windowStart) {
    throw invalidBody(
      'BASELINE_NEEDS_WINDOW',
      'baseline',
      'a counted baseline needs the verification window start',
    );
  }
  const footprint = await caseFootprint(manager, input.tenantId, input.rcaId);
  const observed = await footprintRecurrence(manager, {
    tenantId: input.tenantId,
    footprint,
    from: new Date(input.windowStart.getTime() - baseline.windowDays * DAY_MS),
    to: input.windowStart,
  });
  const value =
    baseline.metric === 'recurrences'
      ? String(observed.recurrences)
      : observed.lossSeconds;
  return {
    metric: baseline.metric,
    windowDays: baseline.windowDays,
    value,
    declared: false,
  };
}
