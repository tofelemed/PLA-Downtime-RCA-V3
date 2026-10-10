/** How a v1 free-text `period` label maps onto production periods (spec §18.2 free-text periods). */
export type ParsedPeriodLabel =
  | { kind: 'day'; localDate: string }
  | { kind: 'instant'; at: string }
  | { kind: 'ambiguous'; reason: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DAY = /^(\d{4})\/(\d{2})\/(\d{2})$/;
/** ISO date-time with an explicit zone — without one the instant would depend on a guessed timezone. */
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const MONTH = /^\d{4}-\d{2}$/;

function validDay(year: string, month: string, day: string): string | null {
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Parses a v1 period label. A calendar day is the plant-local operational date (`local_date` of the
 * generated periods, which already applied the tenant timezone); an ISO instant with a zone picks the
 * period containing it. Months, shift names, local times without a zone, `DD/MM` vs `MM/DD` forms and
 * anything else are ambiguous and go to review — nothing is guessed.
 */
export function parseLegacyPeriodLabel(
  label: string | null | undefined,
): ParsedPeriodLabel {
  const text = (label ?? '').trim();
  if (text === '') return { kind: 'ambiguous', reason: 'empty' };
  const day = DAY.exec(text) ?? SLASH_DAY.exec(text);
  if (day) {
    const localDate = validDay(day[1], day[2], day[3]);
    return localDate
      ? { kind: 'day', localDate }
      : { kind: 'ambiguous', reason: 'invalid date' };
  }
  if (INSTANT.test(text)) {
    const at = new Date(text);
    return Number.isNaN(at.getTime())
      ? { kind: 'ambiguous', reason: 'invalid instant' }
      : { kind: 'instant', at: at.toISOString() };
  }
  if (MONTH.test(text))
    return { kind: 'ambiguous', reason: 'month (roll-up, no single period)' };
  return { kind: 'ambiguous', reason: 'unrecognised format' };
}
