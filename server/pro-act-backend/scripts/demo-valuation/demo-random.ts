import { createHash } from 'crypto';

/**
 * Deterministic "random" demo values: every value is drawn from a mulberry32 PRNG seeded with a hash of
 * (seed, owner id, basis), so reruns and partial reruns produce the same numbers for the same rows.
 * Demo data only — never imported by product code.
 */
export const DEFAULT_SEED = 'proact-demo-valuation-v1';

/** USD ranges of the demo rates (plausible for a bulk-material plant priced per tonne). */
export const DEMO_RANGES = {
  /** contribution margin per tonne of lost output */
  contributionMarginPerUnit: { min: 120, max: 420 },
  /** standard (full) cost per tonne of lost output */
  standardCostPerUnit: { min: 380, max: 950 },
  /** operational cost of one hour of downtime per impact code */
  costPerHour: { min: 1200, max: 6500 },
} as const;

export type DemoRange = { min: number; max: number };

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(parts: readonly string[]): number {
  return createHash('sha256').update(parts.join('|')).digest().readUInt32BE(0);
}

/** A value in [min, max) with two decimals, as the decimal string the API takes. */
export function demoAmount(range: DemoRange, parts: readonly string[]): string {
  const next = mulberry32(seedOf(parts));
  const raw = range.min + next() * (range.max - range.min);
  return (Math.round(raw * 100) / 100).toFixed(2);
}

/** A deterministic pick from a non-empty list. */
export function demoPick<T>(items: readonly T[], parts: readonly string[]): T {
  const next = mulberry32(seedOf(parts));
  return items[Math.floor(next() * items.length)];
}

/** Short, stable Idempotency-Key for one seeder command. */
export function demoKey(parts: readonly string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `demo-valuation-${digest.slice(0, 40)}`;
}
