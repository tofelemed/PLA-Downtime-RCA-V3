import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaActionV2UpdateDto } from '../v2/rca/rca-actions-v2.dto';
import { RCA } from '../rca/rca.entity';
import { readRecommendations } from './rca-case-json';
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
  if (body.recommendationId !== undefined)
    columns.recommendationId = body.recommendationId;
  if (body.verificationMethod !== undefined)
    columns.verificationMethod = body.verificationMethod?.trim() || null;
  if (body.verifierId !== undefined) columns.verifierId = body.verifierId;
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
  if (action.ownerId && !(await isMember(manager, scope, action.ownerId)))
    throw invalidReference('ownerId');
  if (action.verifierId) {
    if (action.verifierId === action.ownerId) {
      throw invalidBody(
        'VERIFIER_IS_OWNER',
        'verifierId',
        "the verifier checks the owner's evidence, so it must be someone other than the owner",
      );
    }
    if (!(await isMember(manager, scope, action.verifierId)))
      throw invalidReference('verifierId');
  }
}

/** A user of the tenant or with a scope in it. */
async function isMember(
  manager: EntityManager,
  scope: RcaScope,
  userId: string,
): Promise<boolean> {
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM "users" u WHERE u."id" = $1 AND (u."tenant_id" = $2
        OR EXISTS (SELECT 1 FROM "user_scopes" s WHERE s."user_id" = u."id" AND s."tenant_id" = $2))`,
    [userId, scope.tenantId],
  );
  return rows.length > 0;
}

/** The verification window is fixed once the action is done (Marun E2E: 409 VERIFICATION_WINDOW_LOCKED). */
export function assertWindowOpenForEdit(
  previous: Pick<
    RcaAction,
    'status' | 'verificationWindowStart' | 'verificationWindowEnd'
  >,
  next: Pick<RcaAction, 'verificationWindowStart' | 'verificationWindowEnd'>,
): void {
  if (previous.status !== 'done') return;
  const same = (a: Date | null, b: Date | null) =>
    (a?.getTime() ?? null) === (b?.getTime() ?? null);
  if (
    same(previous.verificationWindowStart, next.verificationWindowStart) &&
    same(previous.verificationWindowEnd, next.verificationWindowEnd)
  )
    return;
  throw new ConflictException({
    code: 'VERIFICATION_WINDOW_LOCKED',
    message:
      'the verification window is fixed once the action is done; reopen the action to change it',
  });
}

/** Item 5: an action implements one of its case's recommendations (422 INVALID_REFERENCE otherwise). */
export function assertRecommendationOf(
  rca: RCA,
  recommendationId: string | null | undefined,
): void {
  if (!recommendationId) return;
  const known = readRecommendations(rca.recommendations).some(
    (item) => item.id === recommendationId,
  );
  if (!known) throw invalidReference('recommendationId');
}
