import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { SCHEMA_INVALID } from '../common/outbox/outbox-relay.service';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { invalid } from '../profiles/profile-errors';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';

export type DeliveryState = 'delivered' | 'pending' | 'dead' | 'missing';

/** One approved revision and the delivery of its `PeriodApproved` message. */
export interface DeliveryReceipt {
  revisionId: string;
  periodId: string;
  unitId: string;
  revision: number;
  approvedAt: string;
  outboxId: string | null;
  domainEventId: string | null;
  state: DeliveryState;
  attempts: number;
  publishedAt: string | null;
  /** SCHEMA_INVALID or PUBLISH_FAILED; transport messages are not returned */
  lastErrorCode: string | null;
}

export interface DeliveryQuery {
  from: string;
  to: string;
  unitIds?: string[];
  cursor?: string;
  limit: number;
}

interface ReceiptRow {
  revision_id: string;
  period_id: string;
  unit_id: string;
  revision: number;
  approved_at: Date;
  outbox_id: string | null;
  domain_event_id: string | null;
  state: 'pending' | 'published' | 'failed' | null;
  attempts: number | null;
  published_at: Date | null;
  last_error: string | null;
}

const STATES: Record<string, DeliveryState> = {
  published: 'delivered',
  pending: 'pending',
  failed: 'dead',
};

/** Approved revisions of the window with the first `PeriodApproved` outbox row of each (keyset page). */
const RECEIPTS_SQL = `SELECT r."id" AS revision_id, r."period_id", p."unit_id", r."revision", r."approved_at",
        o."id"::text AS outbox_id, o."payload"->>'domainEventId' AS domain_event_id, o."state", o."attempts",
        o."published_at", o."last_error"
   FROM "accounting_revisions" r
   JOIN "production_periods" p ON p."id" = r."period_id"
   LEFT JOIN LATERAL (
     SELECT * FROM "outbox" x
      WHERE x."tenant_id" = r."tenant_id" AND x."aggregate_type" = 'production_period'
        AND x."aggregate_id" = r."period_id"::text AND x."type" = 'PeriodApproved'
        AND x."payload"->>'revisionId' = r."id"::text
      ORDER BY x."id" LIMIT 1) o ON true
  WHERE r."tenant_id" = $1 AND r."lifecycle" = 'approved' AND r."approved_at" >= $2 AND r."approved_at" < $3
    AND ($4::uuid[] IS NULL OR p."unit_id" = ANY($4::uuid[]))
    AND ($5::uuid[] IS NULL OR p."unit_id" = ANY($5::uuid[]))
    AND ($6::timestamptz IS NULL
         OR (date_trunc('milliseconds', r."approved_at"), r."id") > ($6::timestamptz, $7::uuid))
  ORDER BY date_trunc('milliseconds', r."approved_at"), r."id" LIMIT $8`;

function toReceipt(row: ReceiptRow): DeliveryReceipt {
  const errorCode = row.last_error
    ? row.last_error.startsWith(SCHEMA_INVALID)
      ? SCHEMA_INVALID
      : 'PUBLISH_FAILED'
    : null;
  return {
    revisionId: row.revision_id,
    periodId: row.period_id,
    unitId: row.unit_id,
    revision: Number(row.revision),
    approvedAt: new Date(row.approved_at).toISOString(),
    outboxId: row.outbox_id,
    domainEventId: row.domain_event_id,
    state: row.state ? STATES[row.state] : 'missing',
    attempts: row.attempts ?? 0,
    publishedAt: row.published_at
      ? new Date(row.published_at).toISOString()
      : null,
    lastErrorCode: errorCode,
  };
}

/**
 * Delivery reconciliation (plan 2.9, WF03, §15.2 `GET /deliveries/reconciliation`): every revision approved
 * in `[from, to)` next to the outbox delivery of its `PeriodApproved` message — delivered, pending (retrying
 * with backoff), dead (dead-lettered after the retries or a schema violation) or missing. A failed delivery
 * never touches the approval. Tenant- and unit-scoped; keyset on (approved_at, revision id).
 */
@Injectable()
export class DeliveryReconciliationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: DeliveryQuery,
  ): Promise<{ items: DeliveryReceipt[]; nextCursor: string | null }> {
    const tenantId = requireTenantId(context);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
    const allowed = restrictedUnitIds(context, tenantId);
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const rows: ReceiptRow[] = await this.dataSource.query(RECEIPTS_SQL, [
      tenantId,
      from,
      to,
      query.unitIds?.length ? query.unitIds : null,
      allowed,
      after?.at ?? null,
      after?.id ?? null,
      query.limit + 1,
    ]);
    const items = rows.slice(0, query.limit).map(toReceipt);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({
            sortValue: last.approvedAt,
            id: last.revisionId,
          })
        : null;
    return { items, nextCursor };
  }
}

function decodeCursor(cursor: string): { at: Date; id: string } {
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'string') throw invalidCursor();
  return { at: new Date(sortValue), id };
}
