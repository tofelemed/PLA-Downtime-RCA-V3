import {
  ACTUALS_SOURCES,
  ActualsSource,
  BoundaryAdjustment,
  FallbackCondition,
  HierarchyEntry,
  MeasurementHierarchy,
  SOURCE_CLASSES,
  SourceClass,
} from '../domain/actuals/period/period-actuals.types';
import { PolicyBodyError } from './policy-body-error';

const CONDITIONS: readonly FallbackCondition[] = [
  'primary_stale',
  'primary_bad_quality',
  'primary_missing',
  'primary_conflict',
];

/** Sources whose window can be shifted by a boundary lag (samples are read again over the shifted window). */
const LAGGABLE: readonly ActualsSource[] = [
  'pi_counter',
  'pi_rate',
  'mqtt',
  'kafka',
];

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PolicyBodyError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 64): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new PolicyBodyError(
      `${field} must be a text of 1..${max} characters`,
    );
  }
  return value.trim();
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new PolicyBodyError(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function adjustmentOf(
  value: unknown,
  field: string,
): BoundaryAdjustment | null {
  if (value === null || value === undefined) return null;
  const body = record(value, field);
  const lag = body.lagSeconds;
  if (typeof lag !== 'number' || !Number.isInteger(lag) || lag < 0) {
    throw new PolicyBodyError(`${field}.lagSeconds must be an integer ≥ 0`);
  }
  if (typeof body.inventoryChangeAccounted !== 'boolean') {
    throw new PolicyBodyError(
      `${field}.inventoryChangeAccounted must be a boolean`,
    );
  }
  return {
    inventoryChangeAccounted: body.inventoryChangeAccounted,
    lagSeconds: lag,
    evidenceRef: text(body.evidenceRef, `${field}.evidenceRef`, 500),
  };
}

function entryOf(value: unknown, index: number): HierarchyEntry {
  const field = `measurementHierarchy.entries[${index}]`;
  const body = record(value, field);
  const rank = body.rank;
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1) {
    throw new PolicyBodyError(`${field}.rank must be an integer ≥ 1`);
  }
  return {
    rank,
    sourceClass: oneOf<SourceClass>(
      body.sourceClass,
      SOURCE_CLASSES,
      `${field}.sourceClass`,
    ),
    source: oneOf<ActualsSource>(
      body.source,
      ACTUALS_SOURCES,
      `${field}.source`,
    ),
    signalSourceKey:
      body.signalSourceKey === null || body.signalSourceKey === undefined
        ? null
        : text(body.signalSourceKey, `${field}.signalSourceKey`, 500),
    boundary: text(body.boundary, `${field}.boundary`),
    boundaryAdjustment: adjustmentOf(
      body.boundaryAdjustment,
      `${field}.boundaryAdjustment`,
    ),
  };
}

/** Ranks unique, classes in E7 order, one estimate rank last (manual), consistent bridges and signals. */
function checkEntries(boundary: string, entries: HierarchyEntry[]): void {
  const ranks = entries.map((entry) => entry.rank);
  if (new Set(ranks).size !== ranks.length) {
    throw new PolicyBodyError('measurementHierarchy ranks must be unique');
  }
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const order = (entry: HierarchyEntry) =>
    SOURCE_CLASSES.indexOf(entry.sourceClass as SourceClass);
  sorted.forEach((entry, i) => {
    if (i > 0 && order(entry) < order(sorted[i - 1])) {
      throw new PolicyBodyError(
        `rank ${entry.rank} (${entry.sourceClass}) may not rank below ${sorted[i - 1].sourceClass}: calibrated primary, redundant measurement, reconciled record, approved estimate`,
      );
    }
    checkEntry(boundary, entry);
  });
  if (sorted[0].sourceClass === 'approved_estimate') {
    throw new PolicyBodyError(
      'the top rank must be a measurement or record, not an estimate',
    );
  }
  const keyed = sorted
    .filter((entry) => entry.sourceClass !== 'approved_estimate')
    .map((entry) => `${entry.source}|${entry.signalSourceKey ?? ''}`);
  if (new Set(keyed).size !== keyed.length) {
    throw new PolicyBodyError(
      'two ranks of the same source must name different signals (signalSourceKey)',
    );
  }
}

function checkEntry(boundary: string, entry: HierarchyEntry): void {
  const estimate = entry.sourceClass === 'approved_estimate';
  if (estimate !== (entry.source === 'manual')) {
    throw new PolicyBodyError(
      `rank ${entry.rank}: the approved estimate is the manual source (approved estimated adjustments), and only it`,
    );
  }
  const adjustment = entry.boundaryAdjustment;
  if (entry.boundary === boundary && adjustment) {
    throw new PolicyBodyError(
      `rank ${entry.rank}: a boundary adjustment is only for a source at another boundary`,
    );
  }
  if (
    adjustment &&
    adjustment.lagSeconds > 0 &&
    !LAGGABLE.includes(entry.source)
  ) {
    throw new PolicyBodyError(
      `rank ${entry.rank}: a lag applies to counter or rate signals only`,
    );
  }
  if (entry.signalSourceKey && !LAGGABLE.includes(entry.source)) {
    throw new PolicyBodyError(
      `rank ${entry.rank}: signalSourceKey names a counter or rate signal`,
    );
  }
}

/**
 * SME E7 `measurementHierarchy` of a `source_authority` body; absent → undefined (older versions keep
 * primary / fallback). The top rank must be the version's `primarySource`.
 */
export function parseMeasurementHierarchy(
  value: unknown,
  primarySource: ActualsSource,
): MeasurementHierarchy | undefined {
  if (value === undefined || value === null) return undefined;
  const body = record(value, 'measurementHierarchy');
  const boundary = text(body.boundary, 'measurementHierarchy.boundary');
  const conditions = body.conditions;
  if (
    !Array.isArray(conditions) ||
    conditions.some((c) => !CONDITIONS.includes(c as FallbackCondition))
  ) {
    throw new PolicyBodyError(
      `measurementHierarchy.conditions must be a subset of ${CONDITIONS.join(', ')}`,
    );
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw new PolicyBodyError('measurementHierarchy.entries must not be empty');
  }
  const entries = body.entries.map(entryOf);
  checkEntries(boundary, entries);
  const top = [...entries].sort((a, b) => a.rank - b.rank)[0];
  if (top.source !== primarySource || top.boundary !== boundary) {
    throw new PolicyBodyError(
      'the top rank must be the primarySource at the hierarchy boundary',
    );
  }
  return {
    boundary,
    conditions: [...new Set(conditions as FallbackCondition[])],
    entries,
  };
}
