import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { AnalyticsResponse } from '../common/response';
import { breakdownSpec } from '../reports/downtime-report';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import {
  breakdownGroups,
  periodStats,
  policyVersions,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';
import { ChronicGroup } from './ops-reports-v2.dto';

export const CHRONIC_LIMIT = 100;

/**
 * Where a cause sits against the window's medians (R7): frequent and short = chronic (small losses that
 * recur: a systematic fix, RCA); rare and long = sporadic (breakdowns: restore and prevent); frequent and
 * long = major on both; rare and short = minor.
 */
export type Quadrant = 'chronic' | 'sporadic' | 'major' | 'minor';

export interface ChronicRowView {
  key: string | null;
  label: string | null;
  /** stop occurrences and allocated stop seconds in the window */
  stops: string;
  seconds: string;
  /** seconds / stops */
  meanSeconds: string | null;
  quadrant: Quadrant | null;
}

export interface ChronicSporadicView {
  groupBy: ChronicGroup;
  rows: ChronicRowView[];
  truncated: boolean;
  /** the medians the quadrants are cut at (over the rows with stops) */
  medianStops: string | null;
  medianMeanSeconds: string | null;
  calculationRunIds: string[];
}

const LABELS: Readonly<Record<ChronicGroup, string>> = {
  reason: `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "reason_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
  asset: `SELECT "id"::text AS "id", "name" AS "label" FROM "assets" WHERE "id"::text = ANY($1) AND "tenant_id" = $2::uuid`,
};

export function median(values: readonly Dec[]): Dec | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : sorted[mid - 1].plus(sorted[mid]).div(2);
}

export interface Cell {
  key: string | null;
  stops: Dec;
  seconds: Dec;
}

/** Each cause with its mean stop length and quadrant; ties with a median count as "high". */
export function classify(cells: readonly Cell[]): {
  rows: Array<Omit<ChronicRowView, 'label'>>;
  medianStops: Dec | null;
  medianMean: Dec | null;
} {
  const withStops = cells.filter((c) => c.stops.gt(0));
  const means = withStops.map((c) => c.seconds.div(c.stops));
  const medianStops = median(withStops.map((c) => c.stops));
  const medianMean = median(means);
  const rows = cells.map((c) => {
    const mean = c.stops.gt(0) ? c.seconds.div(c.stops) : null;
    const frequent = medianStops !== null && c.stops.gte(medianStops);
    const long = mean !== null && medianMean !== null && mean.gte(medianMean);
    const quadrant: Quadrant | null =
      mean === null
        ? null
        : frequent
          ? long
            ? 'major'
            : 'chronic'
          : long
            ? 'sporadic'
            : 'minor';
    return {
      key: c.key,
      stops: formatDec(c.stops),
      seconds: formatDec(c.seconds),
      meanSeconds: mean === null ? null : formatDec(mean),
      quadrant,
    };
  });
  return { rows, medianStops, medianMean };
}

async function labelsOf(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: ChronicGroup,
  keys: string[],
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows: Array<{ id: string; label: string }> = await manager.query(
    LABELS[groupBy],
    [keys, scope.tenantId],
  );
  return new Map(rows.map((r) => [r.id, r.label]));
}

/** Stops that are not planned or external: unplanned ones and those whose class is not known yet. */
const CLASSES = ['unplanned', 'unknown'] as const;

/** Σ seconds and occurrences per key over the classes, largest seconds first. */
async function cellsOf(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: ChronicGroup,
): Promise<Cell[]> {
  const read = (
    metric: 'duration' | 'frequency',
    scheduleClass: (typeof CLASSES)[number],
  ) =>
    breakdownGroups(
      manager,
      scope,
      breakdownSpec(
        groupBy,
        {
          metric,
          scheduleClass,
          includeMicroStops: true,
        },
        null,
      ),
    );
  const reads = await Promise.all(
    CLASSES.flatMap((c) => [read('duration', c), read('frequency', c)]),
  );
  const cells = new Map<string | null, Cell>();
  reads.forEach((groups, index) => {
    const field = index % 2 === 0 ? 'seconds' : 'stops';
    for (const g of groups) {
      const cell = cells.get(g.key) ?? {
        key: g.key,
        seconds: new Dec(0),
        stops: new Dec(0),
      };
      cell[field] = cell[field].plus(g.amount);
      cells.set(g.key, cell);
    }
  });
  return [...cells.values()].sort((a, b) => b.seconds.comparedTo(a.seconds));
}

/**
 * `GET /reports/chronic-sporadic` (R7): unplanned and not-yet-classified stops (micro-stops included) per
 * reason or asset from the stored breakdown cells of the shown runs — occurrences and allocated seconds, the
 * mean stop length, and the quadrant against the medians of the window. Largest seconds first, at most
 * `CHRONIC_LIMIT` rows.
 */
export async function chronicSporadic(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: ChronicGroup,
): Promise<AnalyticsResponse<ChronicSporadicView>> {
  const [cells, stats] = await Promise.all([
    cellsOf(manager, scope, groupBy),
    periodStats(manager, scope),
  ]);
  const { rows, medianStops, medianMean } = classify(cells);
  const shown = rows.slice(0, CHRONIC_LIMIT);
  const keys = shown.flatMap((r) => (r.key ? [r.key] : []));
  const labels = await labelsOf(manager, scope, groupBy, keys);
  const data: ChronicSporadicView = {
    groupBy,
    rows: shown.map((r) => ({
      ...r,
      label: r.key ? (labels.get(r.key) ?? null) : null,
    })),
    truncated: rows.length > CHRONIC_LIMIT,
    medianStops: medianStops === null ? null : formatDec(medianStops),
    medianMeanSeconds: medianMean === null ? null : formatDec(medianMean),
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: [],
  });
}
