import type { RcaLinkView } from '@/api/v2/types/rca';
import { addCalendarDays, nextPlantDayUtc } from '@/lib/dates';
import { plantToday } from '@/lib/dates/zoned-time';
import { plantDayOf, plantDayStart } from './plant-day';

/** Filters of the link pickers (events, approved loss lines, occurrences); days are plant calendar days. */
export interface LinkPickerFilters {
  /** '' = every unit of the scope */
  unitId: string;
  /** '' = any reason */
  reasonCodeId: string;
  q: string;
  /** `YYYY-MM-DD`, inclusive */
  fromDay: string;
  /** `YYYY-MM-DD`, inclusive (sent as the start of the next day) */
  toDay: string;
}

/** Days of the default window around the trigger event, or before today. */
export const PICKER_WINDOW_DAYS = 30;

interface EventSnapshot {
  start?: unknown;
  unitId?: unknown;
}

/** The case's trigger: its first linked event (by link time), read from the stored evidence package. */
export function triggerOfLinks(links: readonly RcaLinkView[]): { start: string; unitId: string | null } | null {
  const events = links.filter((link) => link.linkType === 'event').sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
  for (const link of events) {
    const event = (link.evidence?.event ?? {}) as EventSnapshot;
    if (typeof event.start === 'string') return { start: event.start, unitId: typeof event.unitId === 'string' ? event.unitId : link.unitId };
  }
  return null;
}

/**
 * The default window: 30 days around the trigger event when known (15 before, 15 after), else the last
 * 30 days up to today (plant days).
 */
export function defaultPickerWindow(triggerStart: string | null, now: Date, timeZone: string): Pick<LinkPickerFilters, 'fromDay' | 'toDay'> {
  if (triggerStart) {
    const day = plantDayOf(triggerStart, timeZone);
    const half = PICKER_WINDOW_DAYS / 2;
    return { fromDay: addCalendarDays(day, -half), toDay: addCalendarDays(day, half) };
  }
  const today = plantToday(timeZone, now);
  return { fromDay: addCalendarDays(today, -(PICKER_WINDOW_DAYS - 1)), toDay: today };
}

/** The half-open UTC window of the chosen days (`to` = start of the day after `toDay`); undefined when a day is missing. */
export function pickerWindow(filters: Pick<LinkPickerFilters, 'fromDay' | 'toDay'>, timeZone: string): { from?: string; to?: string } {
  const from = plantDayStart(filters.fromDay, timeZone) ?? undefined;
  const to = filters.toDay ? (nextPlantDayUtc(filters.toDay, timeZone) ?? undefined) : undefined;
  return { from, to };
}

/** True when the window is usable (both days, from before to): the occurrence search needs one. */
export const hasWindow = (filters: Pick<LinkPickerFilters, 'fromDay' | 'toDay'>): boolean =>
  filters.fromDay !== '' && filters.toDay !== '' && filters.fromDay <= filters.toDay;

/** What identifies an approved loss line across recalculations (its id changes with every run). */
export interface LossLineIdentity {
  periodId: string;
  kind: string;
  causeEventId: string | null;
  segmentStart: string;
  segmentEnd: string;
}

export const lossLineKey = (line: LossLineIdentity): string =>
  [line.periodId, line.kind, line.causeEventId ?? '', Date.parse(line.segmentStart), Date.parse(line.segmentEnd)].join('|');

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function identityOf(evidence: Record<string, unknown> | null): LossLineIdentity | null {
  const line = evidence?.line;
  if (!isRecord(line)) return null;
  const { periodId, kind, causeEventId, segmentStart, segmentEnd } = line;
  if (typeof periodId !== 'string' || typeof kind !== 'string' || typeof segmentStart !== 'string' || typeof segmentEnd !== 'string') return null;
  return { periodId, kind, causeEventId: typeof causeEventId === 'string' ? causeEventId : null, segmentStart, segmentEnd };
}

/**
 * Keys of the loss lines the case is linked to, from each link's stored evidence (Marun G4): a restated
 * period has new line ids, so the picker matches the same period, kind, cause event and segment too.
 */
export function linkedLossLineKeys(links: readonly RcaLinkView[]): ReadonlySet<string> {
  return new Set(
    links.flatMap((link) => {
      if (link.linkType !== 'loss_line') return [];
      const identity = identityOf(link.evidence);
      return identity ? [lossLineKey(identity)] : [];
    }),
  );
}
