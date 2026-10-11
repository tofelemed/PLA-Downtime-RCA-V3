/**
 * Pure, deterministic generator of one shift's events on one unit: Pareto-shaped stops (many short,
 * a few long; breakdowns, minor stops, planned and external stops), an occasional rate cut (slowdown),
 * a quality loss and the shift's production report. The output is derived from the shift's plan target
 * so that target − good = the losses the engine attributes + a small unrecorded speed loss, which makes
 * OEE land around 65–85 % and the period waterfall close. Same seed, unit and shift → same events.
 */
import { leavesFor, ReasonLeaf, ReasonUse } from './catalog-codes';
import { UnitSpec } from './catalog-plants';
import { SeededRandom } from './showcase-random';

const MINUTE_MS = 60_000;

export interface ShiftInput {
  unit: UnitSpec;
  shiftName: string;
  start: number;
  end: number;
  /** Σ plan targets of the shift's period (t) */
  target: number;
  planningRate: number;
  /** stops per shift */
  stops: { min: number; max: number };
  seed: string;
}

export interface GeneratedEvent {
  /** stable id within the plant: `SC-<unit>-<yyyymmddHH>-<kind><n>` */
  eventId: string;
  kind: 'stop' | 'slowdown' | 'quality';
  start: number;
  end: number;
  leaf: ReasonLeaf;
  assetKind: string | null;
  description: string;
  impactFraction?: number;
  quantity?: number;
}

export interface GeneratedShift {
  events: GeneratedEvent[];
  gross: number;
  rejects: number;
}

const STOP_USES: ReadonlyArray<{ use: ReasonUse; weight: number }> = [
  { use: 'breakdown', weight: 46 },
  { use: 'minor', weight: 40 },
  { use: 'planned', weight: 10 },
  { use: 'external', weight: 4 },
];

function minutesFor(
  use: ReasonUse,
  leaf: ReasonLeaf,
  random: SeededRandom,
): number {
  if (use === 'minor') return random.int(2, 4);
  if (use === 'breakdown') return random.pareto(6, 210, 1.15);
  if (use === 'external') return random.int(25, 95);
  if (leaf.code === 'PLAN-PM') return random.int(60, 150);
  if (leaf.code === 'PLAN-CHG') return random.int(40, 110);
  if (leaf.code === 'PLAN-HND') return random.int(10, 15);
  return random.int(20, 45);
}

/** A leaf of the use that fits the unit's equipment, and one of its assets. */
function pickCause(
  unit: UnitSpec,
  use: ReasonUse,
  random: SeededRandom,
): { leaf: ReasonLeaf; assetKind: string | null } {
  const kinds = unit.assets.map((a) => a.kind);
  const fitting = leavesFor(use).filter(
    (l) => l.assets.length === 0 || l.assets.some((k) => kinds.includes(k)),
  );
  const leaf = random.weighted(fitting.length ? fitting : leavesFor(use));
  const assets = leaf.assets.filter((k) => kinds.includes(k));
  return { leaf, assetKind: assets.length ? random.pick(assets) : null };
}

function describe(
  leaf: ReasonLeaf,
  unit: UnitSpec,
  assetKind: string | null,
  minutes: number,
): string {
  const asset = unit.assets.find((a) => a.kind === assetKind)?.name;
  const where = asset ? ` – ${asset}` : '';
  if (leaf.use === 'minor')
    return `Short stop: ${leaf.name.toLowerCase()}${where}`;
  if (leaf.use === 'planned') return `${leaf.name} (${minutes} min planned)`;
  if (leaf.use === 'external') return `${leaf.name}, line held`;
  return `${leaf.name}${where}`;
}

/** Non-overlapping placements inside the shift (stops never fill more than ~45 % of it). */
function placeStops(
  input: ShiftInput,
  random: SeededRandom,
  prefix: string,
): GeneratedEvent[] {
  const shiftMinutes = (input.end - input.start) / MINUTE_MS;
  const count = random.int(input.stops.min, input.stops.max);
  const taken: Array<[number, number]> = [];
  const events: GeneratedEvent[] = [];
  let budget = shiftMinutes * 0.45;
  for (let i = 0; i < count; i += 1) {
    const use = random.weighted(STOP_USES).use;
    const { leaf, assetKind } = pickCause(input.unit, use, random);
    const minutes = Math.min(minutesFor(use, leaf, random), Math.floor(budget));
    if (minutes < 2) continue;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const startMin = random.int(3, Math.max(4, shiftMinutes - minutes - 3));
      const endMin = startMin + minutes;
      if (taken.some(([s, e]) => startMin < e + 2 && endMin > s - 2)) continue;
      taken.push([startMin, endMin]);
      budget -= minutes;
      events.push({
        eventId: `${prefix}-S${String(events.length + 1).padStart(2, '0')}`,
        kind: 'stop',
        start: input.start + startMin * MINUTE_MS,
        end: input.start + endMin * MINUTE_MS,
        leaf,
        assetKind,
        description: describe(leaf, input.unit, assetKind, minutes),
      });
      break;
    }
  }
  return events.sort((a, b) => a.start - b.start);
}

function slowdown(
  input: ShiftInput,
  random: SeededRandom,
  prefix: string,
): GeneratedEvent | null {
  if (!random.chance(0.35)) return null;
  const { leaf, assetKind } = pickCause(input.unit, 'speed', random);
  const minutes = random.int(30, 140);
  const startMin = random.int(
    5,
    Math.max(6, (input.end - input.start) / MINUTE_MS - minutes - 5),
  );
  const fraction = Math.round(random.between(0.1, 0.3) * 100) / 100;
  const rate = Math.round(input.planningRate * (1 - fraction) * 10) / 10;
  return {
    eventId: `${prefix}-D1`,
    kind: 'slowdown',
    start: input.start + startMin * MINUTE_MS,
    end: input.start + (startMin + minutes) * MINUTE_MS,
    leaf,
    assetKind,
    description: `Rate cut to ${rate} t/h (${Math.round(fraction * 100)} %): ${random.pick(['melt temperature drifting', 'feeder hopper low', 'downstream pelletizer limiting', 'die pressure creeping up'])}`,
    impactFraction: fraction,
  };
}

function minutesOf(
  events: readonly GeneratedEvent[],
  uses: readonly ReasonUse[],
): number {
  return events
    .filter((e) => e.kind === 'stop' && uses.includes(e.leaf.use))
    .reduce((sum, e) => sum + (e.end - e.start) / MINUTE_MS, 0);
}

export function generateShift(
  input: ShiftInput,
  prefix: string,
): GeneratedShift {
  const random = new SeededRandom([
    input.seed,
    'shift',
    input.unit.key,
    input.start,
  ]);
  const events = placeStops(input, random, prefix);
  const slow = slowdown(input, random, prefix);
  if (slow) events.push(slow);
  const P = input.planningRate;
  const stopped =
    minutesOf(events, ['breakdown', 'planned', 'external', 'minor']) / 60;
  const derated = slow
    ? ((slow.end - slow.start) / 3_600_000) * (slow.impactFraction ?? 0)
    : 0;
  const rejects =
    Math.round(input.target * random.between(0.004, 0.025) * 100) / 100;
  const unrecorded = input.target * random.between(0.004, 0.03);
  const good = Math.max(
    input.target * 0.25,
    input.target - P * (stopped + derated) - rejects - unrecorded,
  );
  if (rejects > 0) {
    const { leaf } = pickCause(input.unit, 'quality', random);
    const startMin = random.int(
      10,
      Math.max(11, (input.end - input.start) / MINUTE_MS - 40),
    );
    events.push({
      eventId: `${prefix}-Q1`,
      kind: 'quality',
      start: input.start + startMin * MINUTE_MS,
      end: input.start + (startMin + random.int(10, 30)) * MINUTE_MS,
      leaf,
      assetKind: null,
      description: `${leaf.name}: ${rejects.toFixed(2)} t downgraded to off-grade silo`,
      quantity: rejects,
    });
  }
  return { events, gross: Math.round((good + rejects) * 100) / 100, rejects };
}
