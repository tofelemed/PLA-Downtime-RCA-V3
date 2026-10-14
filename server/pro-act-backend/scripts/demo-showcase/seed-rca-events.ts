/**
 * DEMO failure stops of the RCA stories (catalog-rca `failureStops`): unplanned stops on the named asset
 * with the failure mode (and mechanism) the D17 repeat trigger and the CA2 effectiveness verification match
 * on, written before the accounting step so their periods are approved with them. Event ids
 * `SC-RCA-<case>-<days ago>`; existing ones are kept. Descriptions say "Demo".
 */
import { CaseSpec, RCA_CASES, SMALL_RCA_CASES } from './catalog-rca';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, HOUR_MS, iso } from './showcase-window';

interface EventRow {
  id: string;
  eventId: string | null;
}

const START_HOUR = 10;

export const failureEventId = (spec: CaseSpec, daysAgo: number): string =>
  `SC-RCA-${spec.key}-${daysAgo}`;

export function caseSpecs(ctx: ShowcaseContext): readonly CaseSpec[] {
  return ctx.scenario.kind === 'full' ? RCA_CASES : SMALL_RCA_CASES;
}

/** The demo failure stops of a case already written (oldest first). */
export async function failureStopsOf(
  ctx: ShowcaseContext,
  session: PersonaSession,
  spec: CaseSpec,
): Promise<EventRow[]> {
  if (!spec.failureStops) return [];
  const rows = await session.listAll<EventRow>('/v2/production-events', {
    unitIds: ctx.ids.units.get(spec.unitKey) ?? '',
    physicalTypes: 'downtime',
    from: iso(ctx.window.from - 5 * DAY_MS),
    to: iso(ctx.window.now),
  });
  const wanted = [...spec.failureStops.daysAgo]
    .sort((a, b) => b - a)
    .map((days) => failureEventId(spec, days));
  return wanted.flatMap((eventId) =>
    rows.filter((row) => row.eventId === eventId),
  );
}

function stopBody(ctx: ShowcaseContext, spec: CaseSpec, daysAgo: number) {
  const stops = spec.failureStops;
  if (!stops) throw new Error(`${spec.key} has no failure stops`);
  const start = ctx.window.today - daysAgo * DAY_MS + START_HOUR * HOUR_MS;
  return {
    eventId: failureEventId(spec, daysAgo),
    unitId: ctx.ids.units.get(spec.unitKey),
    assetId: ctx.ids.assets.get(`${spec.unitKey}:${stops.assetKind}`),
    startTime: iso(start),
    endTime: iso(start + stops.minutes * 60_000),
    physicalType: 'downtime',
    eventType: 'ProductionLoss',
    reasonCodeId: ctx.ids.reasons.get(spec.reason),
    failureMode: stops.failureMode,
    ...(stops.failureMechanism
      ? { failureMechanism: stops.failureMechanism }
      : {}),
    description: `Demo: ${stops.modeLabel} (${spec.title.replace(/^Demo: /, '')})`,
  };
}

export async function seedRcaFailureStops(ctx: ShowcaseContext): Promise<void> {
  const session = ctx.as('operators', 0);
  for (const spec of caseSpecs(ctx)) {
    if (!spec.failureStops || !ctx.ids.units.has(spec.unitKey)) continue;
    const existing = new Set(
      (await failureStopsOf(ctx, session, spec)).map((row) => row.eventId),
    );
    for (const days of spec.failureStops.daysAgo) {
      if (existing.has(failureEventId(spec, days))) {
        ctx.tally.kept('rca failure stops (demo)');
        continue;
      }
      ctx.tally.add(
        'rca failure stops (demo)',
        1,
        0,
        spec.failureStops.failureMode,
      );
      if (ctx.dryRun) continue;
      await session.post(
        '/v2/production-events',
        stopBody(ctx, spec, days),
        `demo failure stop ${failureEventId(spec, days)}`,
      );
    }
  }
  ctx.logger.log(
    '  Demo: failure stops of the RCA stories written (illustrative data)',
  );
}
