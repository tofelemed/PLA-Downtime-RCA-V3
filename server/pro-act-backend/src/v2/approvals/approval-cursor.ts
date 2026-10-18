import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestContext } from '../../common/context/request-context';
export interface ApprovalCursor {
  at: string;
  id: string;
  kind: string;
  binding: string;
}
export function cursorBinding(context: RequestContext, kind?: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        context.tenantId,
        context.userId,
        kind ?? null,
        [...context.roles].sort(),
        context.scopes.map((scope) => JSON.stringify(scope)).sort(),
      ]),
    )
    .digest('hex');
}
export function decodeApprovalCursor(
  value: string | undefined,
  binding: string,
): ApprovalCursor | null {
  if (!value) return null;
  try {
    const cursor: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (typeof cursor !== 'object' || cursor === null) throw new Error();
    const row = cursor as Partial<ApprovalCursor>;
    if (
      row.binding !== binding ||
      typeof row.at !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.at) ||
      !Number.isFinite(Date.parse(row.at)) ||
      typeof row.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        row.id,
      ) ||
      typeof row.kind !== 'string'
    )
      throw new Error();
    return row as ApprovalCursor;
  } catch {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Refresh the approval inbox to start a new page.',
    });
  }
}
export function encodeApprovalCursor(cursor: ApprovalCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}
