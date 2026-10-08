import { CalendarWarning, GeneratedShift } from './calendar.types';
import { daysBetween, wallOfDate } from './wall-clock';

/**
 * A crew's rotation (spec CAL02: crews are independent rotations and never alter the denominator):
 * on operational date `d` the crew works shift `cycle[(d − anchorDate) mod cycle.length]`; `null` = off.
 */
export interface RotationPattern {
  anchorDate: string;
  cycle: Array<string | null>;
}

export interface CrewRotationInput {
  crewId: string;
  pattern: RotationPattern;
  /** operational dates, `to` exclusive */
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** Shift name the rotation puts its crew on for `localDate`, or null (off / not effective). */
export function rotationShiftOn(
  rotation: CrewRotationInput,
  localDate: string,
): string | null {
  const day = wallOfDate(localDate);
  if (day < wallOfDate(rotation.effectiveFrom)) return null;
  if (rotation.effectiveTo && day >= wallOfDate(rotation.effectiveTo)) {
    return null;
  }
  const { cycle, anchorDate } = rotation.pattern;
  const length = cycle.length;
  const index =
    ((daysBetween(anchorDate, localDate) % length) + length) % length;
  return cycle[index] ?? null;
}

/**
 * Assigns crews to instances (assignment only: bounds, offsets and exclusions are untouched). Exactly
 * one matching rotation sets `crewId`; two or more leave it null with a `crew_conflict` warning.
 */
export function assignCrews<T extends GeneratedShift>(
  instances: readonly T[],
  rotations: readonly CrewRotationInput[],
  warnings: CalendarWarning[] = [],
): T[] {
  const conflicts = new Set<string>();
  const assigned = instances.map((instance) => {
    const crews = [
      ...new Set(
        rotations
          .filter(
            (r) =>
              rotationShiftOn(r, instance.localDate) === instance.shiftName,
          )
          .map((r) => r.crewId),
      ),
    ];
    const key = `${instance.localDate}|${instance.shiftName}`;
    if (crews.length > 1 && !conflicts.has(key)) {
      conflicts.add(key);
      warnings.push({
        code: 'crew_conflict',
        localDate: instance.localDate,
        shiftName: instance.shiftName,
        detail: `${crews.length} crews rotate onto this shift`,
      });
    }
    return { ...instance, crewId: crews.length === 1 ? crews[0] : null };
  });
  return assigned;
}
