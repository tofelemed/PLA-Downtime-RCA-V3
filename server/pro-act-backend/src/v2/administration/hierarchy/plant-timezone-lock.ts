import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Counts in a 409 TIMEZONE_LOCKED stop here (the refusal needs an order of magnitude, not an exact total). */
export const TIMEZONE_USAGE_CAP = 10_000;

/** What already depends on a plant's time zone: local dates, shifts and periods were derived in it. */
export interface PlantTimezoneUsage {
  productionEvents: number;
  signalSamples: number;
  calculatedPeriods: number;
}

/**
 * One query per kind; `limit` caps each count. Signal samples are found through the plant's signals (the
 * sample table is keyed by signal, not by tenant); calculated periods are production periods with a
 * calculation run or an accounting revision.
 */
const USAGE_SQL = (limit: number) => `
  SELECT
    (SELECT count(*) FROM (SELECT 1 FROM "production_events" e
       WHERE e."tenant_id" = $1 LIMIT ${limit}) x)::int AS "productionEvents",
    (SELECT count(*) FROM (SELECT 1 FROM "measurement_samples" m
       WHERE m."signal_id" IN (SELECT s."id" FROM "signals" s WHERE s."tenant_id" = $1)
       LIMIT ${limit}) x)::int AS "signalSamples",
    (SELECT count(*) FROM (SELECT 1 FROM "production_periods" p
       WHERE p."tenant_id" = $1
         AND (EXISTS (SELECT 1 FROM "calculation_runs" r WHERE r."period_id" = p."id")
           OR EXISTS (SELECT 1 FROM "accounting_revisions" a WHERE a."period_id" = p."id"))
       LIMIT ${limit}) x)::int AS "calculatedPeriods"`;

/** Usage of the plant's time zone, each kind counted up to `limit` (1 = "is there any"). */
export async function plantTimezoneUsage(
  manager: EntityManager,
  tenantId: string,
  limit: number = TIMEZONE_USAGE_CAP,
): Promise<PlantTimezoneUsage> {
  const rows: PlantTimezoneUsage[] = await manager.query(USAGE_SQL(limit), [
    tenantId,
  ]);
  return rows[0];
}

export function isTimezoneLocked(usage: PlantTimezoneUsage): boolean {
  return (
    usage.productionEvents > 0 ||
    usage.signalSamples > 0 ||
    usage.calculatedPeriods > 0
  );
}

const plural = (count: number, one: string, many: string, exact: boolean) => {
  if (!exact) return many;
  const shown =
    count >= TIMEZONE_USAGE_CAP
      ? `${TIMEZONE_USAGE_CAP.toLocaleString('en-US')}+`
      : count.toLocaleString('en-US');
  return `${shown} ${count === 1 ? one : many}`;
};

function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Plain-language reason the time zone is read-only, or null when it may change. `exact` names the counts
 * (the 409); otherwise only the kinds ("production events and calculated periods").
 */
export function timezoneLockReason(
  usage: PlantTimezoneUsage,
  exact = false,
): string | null {
  const parts: string[] = [];
  if (usage.productionEvents > 0)
    parts.push(
      plural(
        usage.productionEvents,
        'production event',
        'production events',
        exact,
      ),
    );
  if (usage.signalSamples > 0)
    parts.push(
      plural(usage.signalSamples, 'signal sample', 'signal samples', exact),
    );
  if (usage.calculatedPeriods > 0)
    parts.push(
      plural(
        usage.calculatedPeriods,
        'calculated period',
        'calculated periods',
        exact,
      ),
    );
  if (parts.length === 0) return null;
  return (
    `The time zone can no longer change: this plant already has ${listOf(parts)}, ` +
    'whose local dates and shifts were worked out in the current time zone.'
  );
}

/** 409 TIMEZONE_LOCKED with the (capped) counts in `details`. */
export function timezoneLocked(usage: PlantTimezoneUsage): ConflictException {
  return new ConflictException({
    code: 'TIMEZONE_LOCKED',
    message:
      timezoneLockReason(usage, true) ?? 'The time zone can no longer change',
    details: { ...usage, countCap: TIMEZONE_USAGE_CAP },
  });
}
