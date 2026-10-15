/**
 * Shift calendar of the showcase: one published calendar version per showcase unit (3 × 8 h shifts
 * Morning / Afternoon / Night, operational day from 06:00 UTC, one public holiday), four crews on a
 * 2-2-2-2-off continental rotation (each crew works two mornings, two afternoons, two nights, then two
 * days off). The versions are unit-level on purpose: a site-level version would also schedule the ~100
 * test units of the plant. Authored by a master-data admin, published by a manager.
 */
import { MASTER_DATA_FROM } from './catalog-plants';
import { ShowcaseContext } from './showcase-context';

export const SHIFTS = [
  { name: 'Morning', startLocal: '06:00', endLocal: '14:00' },
  { name: 'Afternoon', startLocal: '14:00', endLocal: '22:00' },
  { name: 'Night', startLocal: '22:00', endLocal: '06:00' },
] as const;

/** the public holiday of the showcase calendar (no production that day) */
export const HOLIDAY = {
  date: '2026-09-23',
  name: 'Demo: planned electrical maintenance shutdown',
};

export const CREWS = [
  'Demo Crew A',
  'Demo Crew B',
  'Demo Crew C',
  'Demo Crew D',
];
export const CYCLE = [
  'Morning',
  'Morning',
  'Afternoon',
  'Afternoon',
  'Night',
  'Night',
  null,
  null,
];

interface VersionRow {
  id: string;
  unitId: string | null;
  state: string;
}

interface CrewRow {
  id: string;
  name: string;
}

interface RotationRow {
  id: string;
  crewId: string;
}

async function seedUnitCalendar(
  ctx: ShowcaseContext,
  unitKey: string,
  unitId: string,
): Promise<void> {
  const author = ctx.as('authors', 0);
  const versions = await author.listAll<VersionRow>('/v2/calendar-versions', {
    unitId,
  });
  if (versions.some((v) => v.state === 'published')) {
    ctx.tally.kept('calendar versions');
    return;
  }
  ctx.tally.created('calendar versions');
  if (ctx.dryRun) return;
  const draft =
    versions.find((v) => v.state === 'draft') ??
    (await author.post<VersionRow>(
      '/v2/calendar-versions',
      {
        unitId,
        timezone: 'Asia/Tehran',
        operationalDayStart: '06:00',
        shiftTemplates: SHIFTS.map((s) => ({ ...s })),
        holidays: [{ ...HOLIDAY, treatment: 'excluded' }],
        effectiveFrom: MASTER_DATA_FROM,
      },
      `calendar ${unitKey}`,
    ));
  await ctx
    .as('managers', 0)
    .post(
      `/v2/calendar-versions/${draft.id}/publish`,
      {},
      `publish calendar ${draft.id}`,
    );
}

async function seedCrews(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const crews = await author.listAll<CrewRow>('/v2/crews');
  for (const [index, name] of CREWS.entries()) {
    let crew = crews.find((c) => c.name === name);
    if (!crew) {
      ctx.tally.created('crews');
      if (ctx.dryRun) continue;
      crew = await author.post<CrewRow>('/v2/crews', { name }, `crew ${name}`);
    } else ctx.tally.kept('crews');
    const rotations = await author.listAll<RotationRow>('/v2/crew-rotations', {
      crewId: crew.id,
    });
    if (rotations.length > 0) {
      ctx.tally.kept('crew rotations');
      continue;
    }
    ctx.tally.created('crew rotations');
    const anchor = new Date(
      Date.parse(`${MASTER_DATA_FROM}T00:00:00Z`) + index * 2 * 86_400_000,
    );
    await author.post(
      '/v2/crew-rotations',
      {
        crewId: crew.id,
        pattern: {
          anchorDate: anchor.toISOString().slice(0, 10),
          cycle: CYCLE,
        },
        effectiveFrom: MASTER_DATA_FROM,
      },
      `rotation ${name}`,
    );
  }
}

/** The crew on shift `shiftName` of operational date `localDate` (YYYY-MM-DD). */
export function crewOn(localDate: string, shiftName: string): string {
  const days = Math.round(
    (Date.parse(`${localDate}T00:00:00Z`) -
      Date.parse(`${MASTER_DATA_FROM}T00:00:00Z`)) /
      86_400_000,
  );
  const index = CREWS.findIndex(
    (_, k) =>
      CYCLE[(((days - 2 * k) % CYCLE.length) + CYCLE.length) % CYCLE.length] ===
      shiftName,
  );
  return index >= 0 ? CREWS[index] : 'Crew A';
}

export async function seedCalendars(ctx: ShowcaseContext): Promise<void> {
  await seedCrews(ctx);
  for (const [unitKey, unitId] of ctx.ids.units) {
    await seedUnitCalendar(ctx, unitKey, unitId);
  }
}
