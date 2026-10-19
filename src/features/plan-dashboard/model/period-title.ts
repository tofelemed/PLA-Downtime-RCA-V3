import { formatOperationalDate, type CalendarDisplayOptions } from '@/lib/dates';

export interface PeriodTitleParts {
  unitName: string;
  /** the period's operational date (`YYYY-MM-DD`) */
  localDate: string;
  /** the calendar shift's name, e.g. "A"; null for a period without a shift */
  shiftName: string | null;
}

/** "Shift A" for a bare shift name; a name that already says "shift" stays as it is. */
export function shiftLabel(shiftName: string): string {
  return /shift/i.test(shiftName) ? shiftName : `Shift ${shiftName}`;
}

/**
 * The period page's h1 and tab title (QA planning, period h1): unit, operational date in the plant's date
 * format and shift, so several open periods can be told apart, e.g. "HDPE Extruder 1 — 2026-10-17 · Shift A".
 */
export function periodTitle(parts: PeriodTitleParts, display: CalendarDisplayOptions = {}): string {
  const date = formatOperationalDate(parts.localDate, display);
  const shift = parts.shiftName?.trim() ? ` · ${shiftLabel(parts.shiftName.trim())}` : '';
  return `${parts.unitName} — ${date}${shift}`;
}

/** The plan's period grid page name: its h1 and every link back to it use this one label (re-test N5). */
export function periodGridTitle(planName: string | null | undefined): string {
  return planName ? `${planName} · period accounting` : 'Period accounting';
}
