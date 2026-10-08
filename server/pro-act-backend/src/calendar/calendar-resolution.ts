import { CalendarDefinition } from '../domain/calendar/calendar.types';
import {
  datesInRange,
  normalizeTime,
  wallOfDate,
} from '../domain/calendar/wall-clock';
import { CalendarVersion } from './entities/calendar-version.entity';

/** What resolution needs of a published version. */
export type ResolvableVersion = Pick<
  CalendarVersion,
  'id' | 'unitId' | 'version' | 'effectiveFrom' | 'effectiveTo'
>;

/** Consecutive operational dates governed by one version. */
export interface VersionRun<V extends ResolvableVersion> {
  version: V;
  from: string;
  to: string;
}

/**
 * Version in force for a unit on an operational date (CAL01: unit calendars inherit with effective-dated
 * overrides): the unit's own published override with the highest version whose `[effective_from,
 * effective_to)` contains the date, else the site calendar likewise; none = no shifts that day.
 */
export function versionOn<V extends ResolvableVersion>(
  versions: readonly V[],
  unitId: string,
  date: string,
): V | null {
  const day = wallOfDate(date);
  const effective = versions.filter(
    (v) =>
      wallOfDate(v.effectiveFrom) <= day &&
      (v.effectiveTo === null || day < wallOfDate(v.effectiveTo)),
  );
  const pick = (candidates: V[]): V | null =>
    candidates.reduce<V | null>(
      (best, v) => (best === null || v.version > best.version ? v : best),
      null,
    );
  return (
    pick(effective.filter((v) => v.unitId === unitId)) ??
    pick(effective.filter((v) => v.unitId === null))
  );
}

/** Dates `[from, to]` grouped into runs of the version in force (dates with none are skipped). */
export function versionRuns<V extends ResolvableVersion>(
  versions: readonly V[],
  unitId: string,
  range: { from: string; to: string },
): Array<VersionRun<V>> {
  const runs: Array<VersionRun<V>> = [];
  let previous: string | null = null;
  for (const date of datesInRange(range.from, range.to)) {
    const version = versionOn(versions, unitId, date);
    const last = runs[runs.length - 1];
    if (
      version &&
      last &&
      last.version.id === version.id &&
      last.to === previous
    ) {
      last.to = date;
    } else if (version) {
      runs.push({ version, from: date, to: date });
    }
    previous = date;
  }
  return runs;
}

/** The generator's view of a stored version. */
export function definitionOf(
  version: Pick<
    CalendarVersion,
    | 'timezone'
    | 'operationalDayStart'
    | 'shiftTemplates'
    | 'workingIntervals'
    | 'holidays'
    | 'exclusions'
  >,
): CalendarDefinition {
  return {
    timezone: version.timezone,
    operationalDayStart: normalizeTime(version.operationalDayStart),
    shiftTemplates: version.shiftTemplates,
    workingIntervals: version.workingIntervals ?? [],
    holidays: version.holidays ?? [],
    exclusions: version.exclusions ?? [],
  };
}
