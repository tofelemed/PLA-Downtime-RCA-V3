/** Demo: operator coding → supervisor verification → maintenance failure validation. */
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface Stop {
  id: string;
  eventId: string | null;
  reasonCodeId: string | null;
  failureMode: string | null;
}
interface Outcome {
  done: string[];
  skipped: Array<{ eventId: string; reason: string }>;
}

export async function seedHdpeVerification(
  ctx: ShowcaseContext,
): Promise<void> {
  if (ctx.dryRun) return;
  const supervisor = ctx.as('engineers', 0);
  const stops = (
    await supervisor.listAll<Stop>('/v2/production-events', {
      unitIds: [...ctx.ids.units.values()],
      physicalTypes: 'downtime',
      from: iso(ctx.window.from),
      to: iso(ctx.window.today - DAY_MS),
    })
  ).filter((row) => row.eventId?.startsWith('SC-') && row.reasonCodeId);
  for (let start = 0; start < stops.length; start += 200) {
    const batch = stops.slice(start, start + 200);
    const result = await supervisor.post<Outcome>(
      '/v2/production-events/verification',
      { eventIds: batch.map((row) => row.id) },
      `Demo verify stops ${batch[0].id}`,
    );
    const unexpected = result.skipped.filter(
      (row) => row.reason !== 'ALREADY_VERIFIED',
    );
    if (unexpected.length)
      throw new Error(`Demo stop verification: ${JSON.stringify(unexpected)}`);
    ctx.tally.add(
      'HDPE supervisor verification',
      result.done.length,
      result.skipped.length,
    );
  }
  for (const stop of stops.filter((row) => row.failureMode)) {
    const result = await ctx
      .as('reliability', 0)
      .post<Outcome>(
        `/v2/production-events/${stop.id}/validate-failure`,
        {},
        `Demo validate failure ${stop.id}`,
      );
    const unexpected = result.skipped.filter(
      (row) => row.reason !== 'ALREADY_VALIDATED',
    );
    if (unexpected.length)
      throw new Error(`Demo failure validation: ${JSON.stringify(unexpected)}`);
    ctx.tally.add(
      'HDPE maintenance validation',
      result.done.length,
      result.skipped.length,
    );
  }
}
