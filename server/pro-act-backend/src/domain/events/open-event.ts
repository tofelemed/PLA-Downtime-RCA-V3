import { PhysicalState } from './event-classification';

/**
 * Physical states that end an event's life as a current fact (DT11): a split or merge contributor
 * (superseded) or a source tombstone (retracted). Such a row may still have no end time — a split
 * parent keeps the interval it had — but it is never a running stop.
 */
export const INACTIVE_PHYSICAL_STATES: readonly PhysicalState[] = [
  'superseded',
  'retracted',
];

/** "Open" = still running: no end time and not superseded or retracted. */
export function isOpenEvent(
  end: Date | string | null | undefined,
  physicalState: PhysicalState | null | undefined,
): boolean {
  if (end !== null && end !== undefined) {
    return false;
  }
  return !INACTIVE_PHYSICAL_STATES.includes(physicalState ?? 'open');
}
