import { Logger } from '@nestjs/common';
import { ApiError, DemoApiClient } from './api-client';
import { demoKey, demoPick } from './demo-random';

interface EventRow {
  id: string;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  rowVersion: number;
  classification: { scheduleClass: string; oeeComponent: string };
}

interface CodeRow {
  id: string;
  code: string;
  name: string;
  version: number;
  active: boolean;
  defaults?: { impactCodeId: string | null };
}

export interface CodingSeedOptions {
  client: DemoApiClient;
  tenantId: string;
  seed: string;
  dryRun: boolean;
}

export interface CodingSeedSummary {
  reasonDefaultsSet: number;
  eventsCoded: number;
  eventsWithoutReason: number;
  failedGroups: string[];
}

const logger = new Logger('DemoValuationSeed');

const REASON = 'Demo valuation seed: apply the reason code default impact code';

/** Keyword → impact code name fragment; anything else is an equipment failure (or a seeded pick). */
const IMPACT_HINTS: ReadonlyArray<[RegExp, RegExp]> = [
  [/setup|changeover|clean/i, /setup/i],
  [/speed|slow/i, /speed/i],
  [/quality|defect|scrap|reject/i, /quality|defect/i],
  [/material|shortage|starv|feed/i, /material|shortage/i],
  [/jam|motor|bearing|seal|electric|trip|fail|break/i, /equipment|failure/i],
];

function impactFor(
  reason: CodeRow,
  impacts: readonly CodeRow[],
  seed: string,
): CodeRow {
  for (const [reasonHint, impactHint] of IMPACT_HINTS) {
    if (!reasonHint.test(reason.name)) continue;
    const match = impacts.find((i) => impactHint.test(i.name));
    if (match) return match;
  }
  return demoPick(impacts, [seed, reason.id, 'impact']);
}

/** Groups by what one bulk-code request applies: the event's own reason code and classification. */
function groupsOf(events: readonly EventRow[]): Map<string, EventRow[]> {
  const groups = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = [
      e.reasonCodeId,
      e.classification.scheduleClass,
      e.classification.oeeComponent,
    ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return groups;
}

/**
 * `impact_code_missing` comes from stop events whose cause has no impact code. Through the public API
 * only: a coded event's reason code gets a default impact code (a new code version, when it has none),
 * then the event is re-coded with its **own** reason code and classification, so only the empty impact
 * code is filled (DT10 bulk coding, revisions recorded). Events without a reason code are left uncoded.
 */
export async function seedImpactCoding(
  options: CodingSeedOptions,
): Promise<CodingSeedSummary> {
  const { client } = options;
  const events = await client.listAll<EventRow>('/api/v2/production-events', {
    physicalTypes: ['downtime', 'slowdown', 'quality_loss'],
    physicalStates: ['open', 'closed'],
  });
  const missing = events.filter((e) => !e.impactCodeId);
  const coded = missing.filter((e) => e.reasonCodeId);
  const impacts = (
    await client.listAll<CodeRow>('/api/v2/impact-codes')
  ).filter((c) => c.active);
  const summary: CodingSeedSummary = {
    reasonDefaultsSet: 0,
    eventsCoded: 0,
    eventsWithoutReason: missing.length - coded.length,
    failedGroups: [],
  };
  if (impacts.length === 0 || coded.length === 0) return summary;
  const ready = new Set<string>();
  for (const [key, group] of groupsOf(coded)) {
    const reasonId = group[0].reasonCodeId as string;
    if (!ready.has(reasonId)) {
      await ensureReasonDefault(options, reasonId, impacts, summary);
      ready.add(reasonId);
    }
    await recode(options, key, group, summary);
  }
  return summary;
}

async function ensureReasonDefault(
  options: CodingSeedOptions,
  reasonId: string,
  impacts: readonly CodeRow[],
  summary: CodingSeedSummary,
): Promise<void> {
  const reason = await options.client.get<CodeRow>(
    `/api/v2/reason-codes/${reasonId}`,
  );
  if (reason.defaults?.impactCodeId || !reason.active) return;
  const impact = impactFor(reason, impacts, options.seed);
  if (options.dryRun) {
    logger.log(`[dry run] reason ${reason.code} → impact ${impact.code}`);
    return;
  }
  await options.client.write(
    'PUT',
    `/api/v2/reason-codes/${reasonId}`,
    { defaultImpactCodeId: impact.id },
    { ifMatch: reason.version },
  );
  summary.reasonDefaultsSet += 1;
}

async function recode(
  options: CodingSeedOptions,
  key: string,
  group: readonly EventRow[],
  summary: CodingSeedSummary,
): Promise<void> {
  const first = group[0];
  const body = {
    reason: REASON,
    items: group.map((e) => ({
      eventId: e.id,
      expectedVersion: e.rowVersion,
    })),
    codes: {
      reasonCodeId: first.reasonCodeId,
      scheduleClass: first.classification.scheduleClass,
      oeeComponent: first.classification.oeeComponent,
    },
    preview: options.dryRun,
  };
  const idempotencyKey = demoKey([
    options.tenantId,
    options.dryRun ? 'bulk-code-preview' : 'bulk-code-apply',
    ...body.items.map((i) => `${i.eventId}@${i.expectedVersion}`),
  ]);
  try {
    await options.client.write(
      'POST',
      '/api/v2/production-events/bulk-code',
      body,
      { idempotencyKey },
    );
    if (!options.dryRun) summary.eventsCoded += group.length;
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) throw error;
    summary.failedGroups.push(`${key}: ${error.message}`);
  }
}
