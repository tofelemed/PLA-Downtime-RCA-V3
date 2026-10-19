import { useState } from 'react';
import { useShiftInstances } from '@/api/v2/queries/units';
import { DAY_MS } from '@/api/v2/queries/time-window';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ShiftInstanceView } from '@/api/v2/types/units';
import { useWindowClock } from './use-window-clock';

export interface ShiftWindows {
  /** shifts of the last 3 days up to the current one (not excluded; a shift that has not started is not offered) */
  instances: ShiftInstanceView[];
  /** the shift running now, when the calendar has one */
  current: ShiftInstanceView | null;
}

/** The shift running at `now`: `[utcStart, utcEnd)` contains it. */
export function currentShiftOf(instances: readonly ShiftInstanceView[], now: number): ShiftInstanceView | null {
  return instances.find((shift) => Date.parse(shift.utcStart) <= now && now < Date.parse(shift.utcEnd)) ?? null;
}

/** QA audit L4: shifts that have started by `now` (tomorrow's shift has no events to show yet). */
export function startedShifts(instances: readonly ShiftInstanceView[], now: number): ShiftInstanceView[] {
  return instances.filter((shift) => !shift.isExcluded && Date.parse(shift.utcStart) <= now);
}

/**
 * Shift instances of one unit around now (shift instances are per unit; none without exactly one unit).
 * The list range is anchored when the picker mounts; "current" follows the window clock.
 */
export function useShiftWindows(unitId: string | null): ShiftWindows {
  const [range] = useState(() => {
    const now = Date.now();
    return { from: new Date(now - 3 * DAY_MS).toISOString(), to: new Date(now + DAY_MS).toISOString() };
  });
  const [now] = useWindowClock(unitId !== null);
  const shifts = useShiftInstances(unitId ? { unitId, ...range } : null);
  const instances = startedShifts(flattenPages(shifts.data?.pages), now);
  return { instances, current: unitId ? currentShiftOf(instances, now) : null };
}
