/**
 * DEMO DATA ONLY (LA-08): the grade-transition matrix of the Demo Plant HDPE lines and the transitions
 * the event history starts each new product campaign with. The reference hours are illustrative values
 * for HDPE twin-screw compounding (black pipe compound → natural grade needs a long purge, the reverse is
 * short; film ↔ moulding grades depend on the melt-index step), chosen to look plausible, not taken from
 * any plant or licensor. Every seeded entry says "Demo" in its evidence and notes; nothing here is a
 * product default. One directional pair (PEL IM55 → PE100-BK) is left out on purpose so the history shows a
 * transition without a standard (`no_transition_standard`).
 *
 * The seeded plans do not deduct these transitions from their targets, so the Demo Plant stays on
 * `oee_policy.transitionAllowanceInPlan = loss` (written by the personas seeder,
 * `scripts/demo-personas/demo-oee-policy.ts`): the allowance is a plan-ledger loss and the waterfalls close.
 */
import { MASTER_DATA_FROM, UnitSpec } from './catalog-plants';
import { campaignsIn } from './campaigns';
import { ShowcaseContext } from './showcase-context';
import { dec, SeededRandom } from './showcase-random';

const FROM = `${MASTER_DATA_FROM}T00:00:00.000Z`;
const HOUR = 3_600_000;
/** transitions start a little after the campaign's first shift begins */
const START_OFFSET_MS = 15 * 60_000;
const MAX_HOURS = 4.5;
/** share of a transition's capacity that leaves as transition off-grade (rest: rate deficit) */
const OFF_GRADE_SHARE = 0.45;

/** Illustrative reference hours per directional product change (from>to). */
const REFERENCE_HOURS: Readonly<Record<string, number>> = {
  'HDPE-PE100-BK>HDPE-F7000': 2.8,
  'HDPE-F7000>HDPE-PE100-BK': 1.3,
  'HDPE-PE100-BK>HDPE-BL3': 2.6,
  'HDPE-BL3>HDPE-PE100-BK': 1.2,
  'HDPE-PE100-BK>HDPE-IM55': 3.0,
  'HDPE-IM55>HDPE-PE100-BK': 1.4,
  'HDPE-F7000>HDPE-BL3': 1.6,
  'HDPE-BL3>HDPE-F7000': 2.1,
  'HDPE-F7000>HDPE-IM55': 2.4,
  'HDPE-IM55>HDPE-F7000': 1.8,
  'HDPE-BL3>HDPE-IM55': 1.5,
  'HDPE-IM55>HDPE-BL3': 1.9,
};

/** the pelletizer follows the extruders: its transitions are shorter */
const UNIT_FACTOR: Readonly<Record<string, number>> = { PEL: 0.6 };
/** units with grade transitions (bagging only changes bags) */
const TRANSITION_UNITS = new Set(['EXT1', 'EXT2', 'PEL']);
/** left out of the matrix on purpose (see the file comment) */
const MISSING = new Set(['PEL:HDPE-IM55>HDPE-PE100-BK']);
/** hours of a change without a standard */
const UNSTANDARDISED_HOURS = 2.2;

export interface PlannedTransition {
  fromCode: string;
  toCode: string;
  start: number;
  end: number;
  /** transition off-grade, t */
  offGrade: number;
}

/** Reference hours of a unit's change, null when the matrix has no entry. */
export function referenceHours(
  unit: UnitSpec,
  fromCode: string,
  toCode: string,
): number | null {
  const pair = `${fromCode}>${toCode}`;
  const base = REFERENCE_HOURS[pair];
  if (base === undefined || MISSING.has(`${unit.key}:${pair}`)) return null;
  return Math.round(base * (UNIT_FACTOR[unit.key] ?? 1) * 10) / 10;
}

function productAt(unit: UnitSpec, ms: number): string | null {
  return campaignsIn(unit, ms, ms + 1)[0]?.productCode ?? null;
}

/**
 * The transition a shift starts with: when a new campaign of another product begins at the shift's
 * start. About a third run past the reference (overrun); the rest finish within it.
 */
export function plannedTransition(
  unit: UnitSpec,
  start: number,
  end: number,
  seed: string,
): PlannedTransition | null {
  if (!TRANSITION_UNITS.has(unit.key)) return null;
  const toCode = productAt(unit, start);
  const fromCode = productAt(unit, start - 1);
  if (!toCode || !fromCode || toCode === fromCode) return null;
  const random = new SeededRandom([seed, 'transition', unit.key, start]);
  const reference = referenceHours(unit, fromCode, toCode);
  const factor = random.chance(0.35)
    ? random.between(1.2, 1.7)
    : random.between(0.8, 1.0);
  const hours = Math.min(
    MAX_HOURS,
    (reference ?? UNSTANDARDISED_HOURS) * factor,
  );
  const from = start + START_OFFSET_MS;
  const to = Math.min(end, from + Math.round(hours * 60) * 60_000);
  const offGrade = unit.sustainedRate * ((to - from) / HOUR) * OFF_GRADE_SHARE;
  return {
    fromCode,
    toCode,
    start: from,
    end: to,
    offGrade: Math.round(offGrade * 10) / 10,
  };
}

interface StandardRow {
  id: string;
  fromProductId: string;
  toProductId: string;
  state: string;
}

async function ensureStandard(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  pair: { from: string; to: string; hours: number },
  existing: readonly StandardRow[],
): Promise<void> {
  const unitId = ctx.ids.units.get(unit.key);
  const fromId = ctx.ids.products.get(pair.from);
  const toId = ctx.ids.products.get(pair.to);
  if (!unitId || !fromId || !toId) return;
  const same = existing.filter(
    (s) => s.fromProductId === fromId && s.toProductId === toId,
  );
  if (same.some((s) => s.state === 'approved')) {
    ctx.tally.kept('transition standards');
    return;
  }
  ctx.tally.created('transition standards');
  if (ctx.dryRun) return;
  const author = ctx.as('authors', 2);
  const blackPurge = pair.from === 'HDPE-PE100-BK';
  const draft =
    same.find((s) => s.state === 'draft') ??
    (await author.post<StandardRow>(
      '/v2/transition-standards',
      {
        unitId,
        fromProductId: fromId,
        toProductId: toId,
        referenceSeconds: dec(pair.hours * 3600, 0),
        ...(blackPurge
          ? {
              referenceOffgradeQty: dec(
                unit.sustainedRate * pair.hours * 0.4,
                1,
              ),
              offgradeUom: 't',
            }
          : {}),
        sampleCount: 5,
        evidence: `Demo: illustrative median of five comparable ${pair.from} → ${pair.to} changes (not plant data)`,
        notes:
          'Demo transition standard seeded by demo-showcase; replace with plant values',
        effectiveFrom: FROM,
      },
      `transition standard ${unit.key} ${pair.from}>${pair.to}`,
    ));
  await ctx
    .approverOtherThan(ctx.personaOf(author), 2)
    .post(
      `/v2/transition-standards/${draft.id}/approve`,
      {},
      `approve transition standard ${draft.id}`,
    );
}

/** The Demo Plant transition matrix: every directional pair of each unit's products (one left out). */
export async function seedTransitionMatrix(
  ctx: ShowcaseContext,
): Promise<void> {
  ctx.logger.log(
    'transitions: seeding the DEMO grade-transition matrix (illustrative values)',
  );
  for (const unit of ctx.scenario.units) {
    const unitId = ctx.ids.units.get(unit.key);
    if (!unitId || !TRANSITION_UNITS.has(unit.key)) continue;
    const existing = await ctx
      .as('authors', 2)
      .listAll<StandardRow>('/v2/transition-standards', { unitId });
    for (const from of unit.products) {
      for (const to of unit.products) {
        const hours = from === to ? null : referenceHours(unit, from, to);
        if (hours === null) continue;
        await ensureStandard(ctx, unit, { from, to, hours }, existing);
      }
    }
  }
}
