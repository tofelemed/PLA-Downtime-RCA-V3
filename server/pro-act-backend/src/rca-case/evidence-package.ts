import { EntityManager } from 'typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ApprovedImpact } from './approved-impact';
import { approvedImpactAsApproved } from './approved-snapshot-view';
import { priorRecurrence } from './rca-recurrence';

const HOUR_MS = 3_600_000;
/** Trend window margin around the event and look-back of the recurrence counts. */
export const TREND_MARGIN_MS = HOUR_MS;
export const RECURRENCE_WINDOW_DAYS = 90;
const MAX_REVISIONS = 50;
const MAX_SIGNALS = 20;

interface CodeRef {
  id: string;
  code: string | null;
  name: string | null;
  versionId: string | null;
}

/** RCA02 evidence package of an event, snapshotted on the link (never recomputed afterwards). */
export interface EventEvidencePackage {
  kind: 'event';
  builtAt: string;
  event: {
    id: string;
    rowVersion: number;
    unitId: string;
    assetId: string | null;
    occurrenceId: string | null;
    eventType: string | null;
    physicalType: string;
    scheduleClass: string;
    physicalState: string;
    start: string;
    end: string | null;
    durationSeconds: number | null;
    workOrderId: string | null;
  };
  revisions: Array<{
    revision: number;
    kind: string;
    actorKind: string | null;
    sourceRevision: string | null;
    createdAt: string;
  }>;
  trendWindow: { from: string; to: string; signalIds: string[] };
  causeCodes: {
    reasonCode: CodeRef | null;
    impactCode: CodeRef | null;
    failureMode: string | null;
  };
  recurrence: {
    windowDays: number;
    sameAsset: number | null;
    sameReason: number | null;
  };
  approvedImpact: ApprovedImpact;
}

const iso = (value: Date | null | undefined) =>
  value ? new Date(value).toISOString() : null;

async function revisionsOf(
  manager: EntityManager,
  tenantId: string,
  eventId: string,
) {
  const rows: Array<{
    revision: number;
    kind: string;
    actor_kind: string | null;
    source_revision: string | null;
    created_at: Date;
  }> = await manager.query(
    `SELECT "revision", "kind"::text AS "kind", "actor_kind"::text AS "actor_kind", "source_revision", "created_at"
       FROM "event_revisions" WHERE "tenant_id" = $1 AND "event_id" = $2 ORDER BY "revision" DESC LIMIT $3`,
    [tenantId, eventId, MAX_REVISIONS],
  );
  return rows.map((row) => ({
    revision: row.revision,
    kind: row.kind,
    actorKind: row.actor_kind,
    sourceRevision: row.source_revision,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function codeOf(
  manager: EntityManager,
  input: {
    table: 'reason_codes' | 'impact_codes';
    id: string | null;
    versionId: string | null;
    tenantId: string;
  },
): Promise<CodeRef | null> {
  if (!input.id) return null;
  const rows: Array<{ code: string; name: string }> = await manager.query(
    `SELECT "code", "name" FROM "${input.table}" WHERE "id" = $1 AND "tenant_id" = $2`,
    [input.id, input.tenantId],
  );
  return {
    id: input.id,
    code: rows[0]?.code ?? null,
    name: rows[0]?.name ?? null,
    versionId: input.versionId,
  };
}

async function causeCodesOf(
  manager: EntityManager,
  tenantId: string,
  event: ProductionEvent,
) {
  const coding: Array<{
    reason_version: string | null;
    impact_version: string | null;
  }> = await manager.query(
    `SELECT "reason_code_version_id" AS "reason_version", "impact_code_version_id" AS "impact_version"
         FROM "event_coding" WHERE "tenant_id" = $1 AND "event_id" = $2 ORDER BY "revision" DESC LIMIT 1`,
    [tenantId, event.id],
  );
  return {
    reasonCode: await codeOf(manager, {
      table: 'reason_codes',
      id: event.reasonCodeId ?? null,
      versionId: coding[0]?.reason_version ?? null,
      tenantId,
    }),
    impactCode: await codeOf(manager, {
      table: 'impact_codes',
      id: event.impactCodeId ?? null,
      versionId: coding[0]?.impact_version ?? null,
      tenantId,
    }),
    failureMode: event.failureMode?.trim() || null,
  };
}

async function trendWindowOf(
  manager: EntityManager,
  tenantId: string,
  event: ProductionEvent,
  now: Date,
) {
  const from = new Date(event.startTime.getTime() - TREND_MARGIN_MS);
  const to = new Date((event.endTime ?? now).getTime() + TREND_MARGIN_MS);
  const signals: Array<{ id: string }> = await manager.query(
    `SELECT "id" FROM "signals" WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "effective_from" < $4
        AND ("effective_to" IS NULL OR "effective_to" > $3) ORDER BY "id" LIMIT $5`,
    [tenantId, event.unitId, from, to, MAX_SIGNALS],
  );
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    signalIds: signals.map((row) => row.id),
  };
}

/**
 * Builds the evidence package of an event at link time: event facts and revision, revision history
 * with source revision refs, trend window (signals of the unit ± 1 h), cause codes with their versions,
 * recurrence on the same asset / reason in the last 90 days, and the approved impact from the ledger.
 */
export async function eventEvidencePackage(
  manager: EntityManager,
  tenantId: string,
  event: ProductionEvent,
  now = new Date(),
): Promise<EventEvidencePackage> {
  return {
    kind: 'event',
    builtAt: now.toISOString(),
    event: {
      id: event.id,
      rowVersion: event.rowVersion,
      unitId: event.unitId,
      assetId: event.assetId ?? null,
      occurrenceId: event.occurrenceId ?? null,
      eventType: event.eventType ?? null,
      physicalType: event.physicalType,
      scheduleClass: event.scheduleClass,
      physicalState: event.physicalState,
      start: event.startTime.toISOString(),
      end: iso(event.endTime),
      durationSeconds: event.durationSeconds ?? null,
      workOrderId: event.workOrderId ?? null,
    },
    revisions: await revisionsOf(manager, tenantId, event.id),
    trendWindow: await trendWindowOf(manager, tenantId, event, now),
    causeCodes: await causeCodesOf(manager, tenantId, event),
    recurrence: await priorRecurrence(manager, {
      tenantId,
      assetId: event.assetId ?? null,
      reasonCodeId: event.reasonCodeId ?? null,
      before: event.startTime,
      windowDays: RECURRENCE_WINDOW_DAYS,
    }),
    approvedImpact: await approvedImpactAsApproved(manager, tenantId, {
      eventIds: [event.id],
    }),
  };
}
