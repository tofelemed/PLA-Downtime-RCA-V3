/**
 * Guide lesson 7 / E2E §6: the default-site calendar (Asia/Tehran, operational day from 06:00, effective
 * 17 Oct 2026, shifts A 06–14, B 14–22, C 22–06, no exclusions) drafted by Bahram and published by Reza,
 * and crews A / B / C with their rotations (labels only; they never change scheduled time).
 */
import { CREWS, PLANT, SHIFTS, TIMES } from './train-catalog';
import { TrainContext } from './train-context';

interface VersionRow {
  id: string;
  unitId: string | null;
  state: string;
  effectiveFrom: string;
}

interface CrewRow {
  id: string;
  name: string;
}

async function ensureCalendar(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const versions = (
    await author.listAll<VersionRow>('/v2/calendar-versions')
  ).filter(
    (v) =>
      v.unitId === null &&
      v.effectiveFrom.slice(0, 10) === TIMES.operationalDate,
  );
  if (versions.some((v) => v.state === 'published')) {
    ctx.tally.kept('calendar');
    return;
  }
  ctx.tally.created('calendar');
  if (ctx.dryRun) return;
  const draft =
    versions.find((v) => v.state === 'draft') ??
    (await author.post<VersionRow>(
      '/v2/calendar-versions',
      {
        timezone: PLANT.timezone,
        operationalDayStart: '06:00',
        shiftTemplates: SHIFTS.map((s) => ({ ...s })),
        effectiveFrom: TIMES.operationalDate,
      },
      'calendar default site',
    ));
  await ctx
    .as('reza')
    .post(
      `/v2/calendar-versions/${draft.id}/publish`,
      {},
      `publish calendar ${draft.id}`,
    );
}

async function ensureRotation(
  ctx: TrainContext,
  crew: CrewRow,
  cycle: readonly string[],
): Promise<void> {
  const author = ctx.as('bahram');
  const rotations = await author.listAll<{ id: string }>('/v2/crew-rotations', {
    crewId: crew.id,
  });
  if (rotations.length > 0) {
    ctx.tally.kept('crew rotations');
    return;
  }
  ctx.tally.created('crew rotations');
  if (ctx.dryRun) return;
  await author.post(
    '/v2/crew-rotations',
    {
      crewId: crew.id,
      pattern: { anchorDate: TIMES.operationalDate, cycle: [...cycle] },
      effectiveFrom: TIMES.operationalDate,
    },
    `rotation ${crew.name}`,
  );
}

async function ensureCrews(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const crews = await author.listAll<CrewRow>('/v2/crews');
  for (const spec of CREWS) {
    let crew = crews.find((c) => c.name === spec.name);
    if (crew) ctx.tally.kept('crews');
    else {
      ctx.tally.created('crews');
      if (ctx.dryRun) {
        ctx.tally.created('crew rotations');
        continue;
      }
      crew = await author.post<CrewRow>(
        '/v2/crews',
        { name: spec.name },
        `crew ${spec.name}`,
      );
    }
    await ensureRotation(ctx, crew, spec.cycle);
  }
}

export async function seedCalendar(ctx: TrainContext): Promise<void> {
  await ensureCalendar(ctx);
  await ensureCrews(ctx);
}
