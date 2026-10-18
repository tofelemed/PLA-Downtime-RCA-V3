import { queryInboxRows, toApprovalItem } from './approval-inbox-query';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { VERSION_APPROVALS } from './approval-catalog';
import { WORKFLOW_APPROVALS } from './approval-workflows';
import {
  ApprovalInboxQueryDto,
  ApprovalInboxView,
  ApprovalItemView,
} from './approval-inbox-v2.dto';
import {
  cursorBinding,
  decodeApprovalCursor,
  encodeApprovalCursor,
} from './approval-cursor';

export const APPROVAL_DEFINITIONS = [
  ...VERSION_APPROVALS,
  ...WORKFLOW_APPROVALS,
];
@Injectable()
export class ApprovalInboxService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}
  async list(
    context: RequestContext,
    query: ApprovalInboxQueryDto,
  ): Promise<ApprovalInboxView> {
    const tenantId = requireTenantId(context);
    if (
      query.kind &&
      !APPROVAL_DEFINITIONS.some((item) => item.kind === query.kind)
    )
      throw new BadRequestException('Unknown approval kind');
    const binding = cursorBinding(context, query.kind);
    const cursor = decodeApprovalCursor(query.cursor, binding);
    const definitions = APPROVAL_DEFINITIONS.filter(
      (item) => !query.kind || item.kind === query.kind,
    );
    const pages = await Promise.all(
      definitions.map(async (definition) =>
        (
          await queryInboxRows(this.manager, context, definition, {
            query,
            cursor,
          })
        ).map((row) => toApprovalItem(context, definition, row)),
      ),
    );
    return approvalPage(pages.flat(), {
      limit: query.limit,
      binding,
      tenantId,
    });
  }
}
function approvalPage(
  all: ApprovalItemView[],
  page: { limit: number; binding: string; tenantId: string },
): ApprovalInboxView {
  all.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id) ||
      a.kind.localeCompare(b.kind),
  );
  const items = all.slice(0, page.limit);
  const last = items.at(-1);
  const nextCursor =
    all.length > page.limit && last
      ? encodeApprovalCursor({
          at: last.createdAt,
          id: last.id,
          kind: last.kind,
          binding: page.binding,
        })
      : null;
  return {
    items,
    nextCursor,
    asOf: new Date().toISOString(),
    scope: { tenantId: page.tenantId },
  };
}
