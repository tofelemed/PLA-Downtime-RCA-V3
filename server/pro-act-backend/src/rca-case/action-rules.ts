import { EntityManager } from 'typeorm';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaActionV2UpdateDto } from '../v2/rca/rca-actions-v2.dto';
import { invalidBody, invalidReference, RcaScope } from './rca-scope';

const date = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Columns of `rca_actions` a body sets (undefined = untouched). The baseline is computed separately and
 * the completion (date, verifier) is applied by `applyCompletion` (CA4).
 */
export function actionColumns(body: RcaActionV2UpdateDto): Partial<RcaAction> {
  const columns: Partial<RcaAction> = {};
  if (body.title !== undefined) columns.title = body.title;
  if (body.description !== undefined) columns.description = body.description;
  if (body.ownerId !== undefined) columns.ownerId = body.ownerId;
  if (body.dueDate !== undefined) columns.dueDate = date(body.dueDate) ?? null;
  if (body.status !== undefined) columns.status = body.status;
  if (body.actionType !== undefined) columns.actionType = body.actionType;
  if (body.completionEvidenceRef !== undefined)
    columns.completionEvidenceRef = body.completionEvidenceRef;
  if (body.completionAttachments !== undefined)
    columns.completionAttachments = body.completionAttachments.map((file) => ({
      fileName: file.fileName,
      name: file.name,
    }));
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

/** CA3: a typed baseline value is refused; the server computes it and a correction is proposed instead. */
export function assertNoDeclaredBaseline(body: RcaActionV2UpdateDto): void {
  if (body.baseline?.value === undefined) return;
  throw invalidBody(
    'BASELINE_DECLARED',
    'baseline.value',
    'the baseline is computed from recorded history; propose a correction with its reason instead',
  );
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
