/**
 * Deterministic pseudo-random values for the showcase: a mulberry32 stream seeded with a hash of
 * (seed, parts), so the same seed and the same unit / day always produce the same numbers. Demo data only.
 */
import { createHash } from 'crypto';

export const DEFAULT_SEED = 'proact-demo-showcase-v1';

export class SeededRandom {
  private state: number;

  constructor(parts: readonly (string | number)[]) {
    this.state = createHash('sha256')
      .update(parts.join('|'))
      .digest()
      .readUInt32BE(0);
  }

  /** a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.between(min, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** a pick weighted by `weight` */
  weighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  /** Pareto-shaped duration: many short, a few long (minutes, clamped). */
  pareto(minMinutes: number, maxMinutes: number, shape: number): number {
    const u = Math.min(this.next(), 0.999);
    const value = minMinutes / Math.pow(1 - u, 1 / shape);
    return Math.min(Math.round(value), maxMinutes);
  }
}

/** Fixed-point decimal string as the API takes quantities. */
export function dec(value: number, places = 3): string {
  return value.toFixed(places);
}
