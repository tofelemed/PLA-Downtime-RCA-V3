import { EntityManager } from 'typeorm';
import {
  countBy,
  emptyPlan,
  JobScope,
  PlanSource,
  RemediationPlan,
  ReviewItemDraft,
  RowChange,
  tenantFilter,
} from '../remediation-types';

/** A supplied minutes value may differ from the timestamps by this much before it is flagged. */
const DURATION_TOLERANCE_SECONDS = 60;
const OPEN_FRAME_SENTINEL = '9999-01-01T00:00:00Z';

interface DurationRow {
  id: string;
  tenant: string | null;
  source: string | null;
  legacy: string;
  unit: string | null;
  seconds: string | null;
}

function durationIssue(row: DurationRow): ReviewItemDraft | null {
  const base = {
    tenantId: row.tenant,
    legacyTable: 'production_events',
    legacyId: row.id,
  };
  if (row.unit === null) {
    return {
      ...base,
      issue: 'DURATION_UNIT_UNKNOWN',
      details: {
        legacyDuration: row.legacy,
        source: row.source,
        durationSeconds: row.seconds,
      },
    };
  }
  if (row.seconds === null || row.unit !== 'min') return null;
  const supplied = Number(row.legacy) * 60;
  if (Math.abs(supplied - Number(row.seconds)) <= DURATION_TOLERANCE_SECONDS)
    return null;
  return {
    ...base,
    issue: 'DURATION_MISMATCH',
    details: {
      legacyDurationMinutes: row.legacy,
      durationSeconds: row.seconds,
      rule: 'timestamps win; the supplied duration is kept in legacy_duration',
    },
  };
}

/**
 * §18.2 mixed duration units: durations are recomputed from start / end by the generated column (1.1);
 * here every legacy value whose unit was not documented (only PI was, as minutes) and every PI minute
 * value that disagrees with its timestamps goes to review. Nothing is inferred or rewritten.
 */
export const durationsJob: PlanSource = {
  name: 'durations',
  summary:
    'legacy durations: unknown unit or disagreeing with timestamps → review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const rows: DurationRow[] = await manager.query(
      `SELECT "id", "tenant_id" AS "tenant", "source", "legacy_duration"::text AS "legacy",
              "legacy_duration_unit_assumed" AS "unit", "duration_seconds"::text AS "seconds"
         FROM "production_events"
        WHERE "legacy_duration" IS NOT NULL AND ${tenantFilter('"tenant_id"')}`,
      [scope.tenantId],
    );
    const plan = emptyPlan();
    plan.reviews = rows
      .map(durationIssue)
      .filter((item): item is ReviewItemDraft => item !== null);
    plan.findings = {
      legacyDurations: rows.length,
      assumedMinutes: rows.filter((r) => r.unit === 'min').length,
      ...countBy(plan.reviews, (r) => r.issue),
    };
    return plan;
  },
};

interface SentinelRow {
  id: string;
  tenant: string | null;
  endText: string;
  state: string;
  raw: string | null;
}

function sentinelChange(row: SentinelRow): RowChange {
  return {
    kind: 'update',
    table: 'production_events',
    rowId: row.id,
    before: {
      end_time: row.endText,
      legacy_end_sentinel: null,
      physical_state: row.state,
    },
    after: {
      end_time: null,
      legacy_end_sentinel: row.endText,
      physical_state: row.state === 'closed' ? 'open' : row.state,
    },
  };
}

/**
 * §18.2 year-9999 sentinel: the 1.1 migration already turned PI open-frame ends into open intervals;
 * this re-verifies and converts any written since (end → null, raw kept in `legacy_end_sentinel`); a
 * row that already holds a raw sentinel is never overwritten (review).
 */
export const sentinelsJob: PlanSource = {
  name: 'sentinels',
  summary: 'remaining 9999 end sentinels → open interval, raw value kept',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const all: SentinelRow[] = await manager.query(
      `SELECT "id", "tenant_id" AS "tenant", "end_time"::text AS "endText", "physical_state"::text AS "state",
              "legacy_end_sentinel"::text AS "raw"
         FROM "production_events" WHERE "end_time" >= $2 AND ${tenantFilter('"tenant_id"')}`,
      [scope.tenantId, OPEN_FRAME_SENTINEL],
    );
    const rows = all.filter((row) => row.raw === null);
    const converted: Array<{ n: number }> = await manager.query(
      `SELECT count(*)::int AS "n" FROM "production_events"
        WHERE "legacy_end_sentinel" IS NOT NULL AND ${tenantFilter('"tenant_id"')}`,
      [scope.tenantId],
    );
    const plan = emptyPlan();
    plan.changes = rows.map(sentinelChange);
    plan.reviews = all
      .filter((row) => row.raw !== null)
      .map((row) => ({
        tenantId: row.tenant,
        legacyTable: 'production_events',
        legacyId: row.id,
        issue: 'SENTINEL_RAW_EXISTS',
        details: { endTime: row.endText, legacyEndSentinel: row.raw },
      }));
    plan.findings = {
      sentinelsRemaining: all.length,
      alreadyConverted: converted[0].n,
    };
    return plan;
  },
};

interface DuplicateGroup {
  tenant: string | null;
  source: string;
  eventId: string;
  ids: string[];
  variants: number;
  edited: number;
}

function duplicateGroupPlan(
  group: DuplicateGroup,
  plan: RemediationPlan,
): void {
  const [canonical, ...others] = group.ids;
  const details = {
    source: group.source,
    eventId: group.eventId,
    ids: group.ids,
  };
  const base = {
    tenantId: group.tenant,
    legacyTable: 'production_events',
    legacyId: canonical,
  };
  if (group.variants > 1 || group.edited > 1) {
    plan.reviews.push({ ...base, issue: 'DUPLICATE_CONFLICT', details });
    return;
  }
  plan.reviews.push({
    ...base,
    issue: 'DUPLICATE_MERGE_PENDING',
    details: {
      ...details,
      canonical,
      rule: 'merge with the v2 merge operation after acceptance',
    },
  });
  for (const id of others) {
    plan.crosswalk.push({
      tenantId: group.tenant,
      legacyTable: 'production_events',
      legacyId: id,
      newTable: 'production_events',
      newId: canonical,
      relation: 'duplicate_of',
    });
  }
}

/**
 * §18.2 duplicate source events: rows of one tenant with the same source and business id. Identical
 * facts with at most one edited copy → canonical chosen (the edited copy, else the oldest), crosswalk
 * `duplicate_of` and a pending-merge review item; differing facts or several edited copies → conflict
 * review. Events are not changed here: the merge itself goes through the v2 merge operation (DT09),
 * which keeps revisions and lineage.
 */
export const duplicatesJob: PlanSource = {
  name: 'duplicates',
  summary:
    'duplicate source events → canonical + crosswalk, conflicts → review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const groups: DuplicateGroup[] = await manager.query(
      `SELECT "tenant_id" AS "tenant", coalesce("source", '') AS "source", "event_id" AS "eventId",
              array_agg("id"::text ORDER BY ("reason_code_id" IS NULL AND "user_overrides" = '{}'::jsonb), "created_at", "id") AS "ids",
              count(DISTINCT md5(concat_ws('|', "unit_id", "start_time", coalesce("end_time"::text, '-'),
                    coalesce("quantity"::text, '-'), coalesce("event_type", '-'))))::int AS "variants",
              count(*) FILTER (WHERE "reason_code_id" IS NOT NULL OR "user_overrides" <> '{}'::jsonb)::int AS "edited"
         FROM "production_events"
        WHERE "event_id" IS NOT NULL AND "retracted_at" IS NULL AND "superseded_by_event_id" IS NULL
          AND ${tenantFilter('"tenant_id"')}
        GROUP BY 1, 2, 3 HAVING count(*) > 1`,
      [scope.tenantId],
    );
    const plan = emptyPlan();
    for (const group of groups) duplicateGroupPlan(group, plan);
    plan.findings = {
      duplicateGroups: groups.length,
      duplicateRows: groups.reduce((n, g) => n + g.ids.length - 1, 0),
      ...countBy(plan.reviews, (r) => r.issue),
    };
    return plan;
  },
};
