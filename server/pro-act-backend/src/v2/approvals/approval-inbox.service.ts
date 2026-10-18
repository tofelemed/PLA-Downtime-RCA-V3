import { queryInboxRows, toApprovalItem } from './approval-inbox-query';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { VERSION_APPROVALS } from './approval-catalog';
import { WORKFLOW_APPROVALS } from './approval-workflows';
import {
  ApprovalChangesView,
  ApprovalInboxQueryDto,
  ApprovalInboxView,
  ApprovalItemView,
} from './approval-inbox-v2.dto';
import { ApprovalChangesService } from './changes/approval-changes.service';
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
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly changes: ApprovalChangesService,
  ) {}
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
    const binding = cursorBinding(
      context,
      query.decidable === 'true' ? `${query.kind ?? ''}|decidable` : query.kind,
    );
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
    const page = approvalPage(pages.flat(), {
      limit: query.limit,
      binding,
      tenantId,
    });
    return { ...page, items: await this.withHeadlines(tenantId, page.items) };
  }

  /** One batch per kind on the page (only the rows shown), never one read per row. */
  private async withHeadlines(
    tenantId: string,
    items: ApprovalItemView[],
  ): Promise<ApprovalItemView[]> {
    const kinds = [...new Set(items.map((item) => item.kind))];
    const headlines = await Promise.all(
      kinds.map(async (kind) => {
        const ids = items
          .filter((item) => item.kind === kind)
          .map((item) => item.id);
        return [
          kind,
          await this.changes.headlinesOf(tenantId, kind, ids),
        ] as const;
      }),
    );
    const byKind = new Map(headlines);
    return items.map((item) => ({
      ...item,
      headline: byKind.get(item.kind)?.get(item.id) ?? null,
    }));
  }

  /**
   * "Exactly the value needing approval" of one pending record: its fields against the approved /
   * effective predecessor, or its full content without one. Same 404 / 400 as `get`.
   */
  async changesOf(
    context: RequestContext,
    kind: string,
    id: string,
  ): Promise<ApprovalChangesView> {
    const item = await this.get(context, kind, id);
    const sets = await this.changes.changesOf(requireTenantId(context), kind, [
      id,
    ]);
    const set = sets.get(id) ?? {
      mode: 'full',
      beforeLabel: null,
      afterLabel: 'Pending',
      fields: [],
    };
    return { kind: item.kind, id: item.id, ...set };
  }

  /**
   * One pending record of the inbox (the approval detail page): the same row, role / scope filter and
   * separation-of-duties actions as the list. 404 when it is not pending, not in the caller's approval scope
   * or not in the plant — a decided record is gone, as in the list.
   */
  async get(
    context: RequestContext,
    kind: string,
    id: string,
  ): Promise<ApprovalItemView> {
    requireTenantId(context);
    const definition = APPROVAL_DEFINITIONS.find((item) => item.kind === kind);
    if (!definition) throw new BadRequestException('Unknown approval kind');
    const [row] = await queryInboxRows(this.manager, context, definition, {
      query: { limit: 1 },
      cursor: null,
      recordId: id,
    });
    if (!row) {
      throw new NotFoundException('This record is not pending your approval');
    }
    const [item] = await this.withHeadlines(requireTenantId(context), [
      toApprovalItem(context, definition, row),
    ]);
    return item;
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
