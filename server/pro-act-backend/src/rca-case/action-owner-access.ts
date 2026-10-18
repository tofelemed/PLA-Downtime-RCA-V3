import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { satisfiesRole } from '../auth/roles/role-model';
import { RequestContext } from '../common/context/request-context';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RcaActionV2UpdateDto } from '../v2/rca/rca-actions-v2.dto';
import { RCA_WRITERS } from './rca-scope';

/** What an action's owner who is not an RCA writer may change on their own action (Marun E2E, owner rule). */
const OWNER_FIELDS: ReadonlySet<string> = new Set([
  'status',
  'completionEvidenceRef',
  'completionAttachments',
]);
/** The statuses an owner may set: progress only; done needs a verifier (CA4), cancelling is a writer's call. */
const OWNER_STATUSES: ReadonlySet<string> = new Set(['open', 'in_progress']);

/** An RCA writer (reliability engineer, manager approver) or a SuperAdmin. */
export function isRcaWriter(context: RequestContext): boolean {
  return (
    context.isSuperAdmin ||
    RCA_WRITERS.some((role) => satisfiesRole(context.roles, role))
  );
}

const forbidden = (message: string) =>
  new ForbiddenException({ code: 'FORBIDDEN_ROLE', message });

/**
 * The owner of an action who is not an RCA writer works it: moves it between open and in progress and
 * records its completion evidence. Marking it done stays with a verifier who is not the owner (CA4, 403
 * SEPARATION_OF_DUTIES); every other field, other people's actions and finished actions are refused.
 */
export function assertOwnerPatch(
  context: RequestContext,
  action: RcaAction,
  body: RcaActionV2UpdateDto,
): void {
  if (isRcaWriter(context)) return;
  if (!context.userId || action.ownerId !== context.userId) {
    throw forbidden(
      'only RCA writers and the owner of an action may change it',
    );
  }
  if (action.status === 'done' || action.status === 'cancelled') {
    throw new ConflictException({
      code: 'ACTION_FINISHED',
      message: `the action is ${action.status}; an RCA writer reopens it before it changes again`,
    });
  }
  const fields = Object.keys(body).filter(
    (key) => body[key as keyof RcaActionV2UpdateDto] !== undefined,
  );
  const other = fields.filter((field) => !OWNER_FIELDS.has(field));
  if (other.length > 0) {
    throw forbidden(
      `as the owner you may change the status (open, in progress) and the completion evidence, not: ${other.join(', ')}`,
    );
  }
  if (body.status === 'done') {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message:
        'an action is marked done by someone who checks its evidence, not by its owner',
    });
  }
  if (body.status !== undefined && !OWNER_STATUSES.has(body.status)) {
    throw forbidden(
      'as the owner you may set the status to open or in progress',
    );
  }
}

/** Uploading a completion file: RCA writers, or the owner of an unfinished action of the case. */
export async function assertCanUpload(
  manager: EntityManager,
  context: RequestContext,
  input: { tenantId: string; rcaId: string },
): Promise<void> {
  if (isRcaWriter(context)) return;
  const rows: unknown[] = context.userId
    ? await manager.query(
        `SELECT 1 FROM "rca_actions" WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "owner_id" = $3
            AND "status" IN ('open', 'in_progress') LIMIT 1`,
        [input.tenantId, input.rcaId, context.userId],
      )
    : [];
  if (rows.length === 0) {
    throw forbidden(
      'files of a case are uploaded by RCA writers or by the owner of one of its open actions',
    );
  }
}
