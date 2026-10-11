/**
 * Shared pieces of the demo MQTT seeder: the seed context every step receives, the outcome each step
 * reports (`created` / `kept` / `planned` for a dry run) and deterministic Idempotency-Keys.
 */
import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { DemoApiClient } from '../demo-valuation/api-client';

export interface SeedContext {
  client: DemoApiClient;
  tenantId: string;
  dryRun: boolean;
  logger: Logger;
}

export type OutcomeStatus = 'created' | 'kept' | 'planned';

/** One seeded thing: what it is, whether it was created, kept as is, or only planned (dry run). */
export interface Outcome {
  what: string;
  status: OutcomeStatus;
  id: string | null;
  note?: string;
}

/** Short, stable Idempotency-Key for one seeder write (same inputs → same key → replayed response). */
export function seedKey(parts: readonly string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `demo-mqtt-${digest.slice(0, 40)}`;
}

/** Canonical JSON (sorted keys) for comparing what exists with what the plan wants. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  );
}

export function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Reports one outcome at the level its status deserves. */
export function report(ctx: SeedContext, outcome: Outcome): Outcome {
  const id = outcome.id ? ` ${outcome.id}` : '';
  const note = outcome.note ? ` (${outcome.note})` : '';
  const prefix =
    outcome.status === 'planned' ? '[dry run] would create' : outcome.status;
  ctx.logger.log(`${prefix}: ${outcome.what}${id}${note}`);
  return outcome;
}

/** Outcome of a write that a dry run skips: `planned` without writing, else the creator's result. */
export async function createUnlessDryRun(
  ctx: SeedContext,
  what: string,
  create: () => Promise<{ id: string }>,
): Promise<Outcome> {
  if (ctx.dryRun) return report(ctx, { what, status: 'planned', id: null });
  const created = await create();
  return report(ctx, { what, status: 'created', id: created.id });
}

export function summarize(outcomes: readonly Outcome[]): string {
  const count = (status: OutcomeStatus) =>
    outcomes.filter((outcome) => outcome.status === status).length;
  return `${count('created')} created, ${count('kept')} kept, ${count('planned')} planned (dry run)`;
}
