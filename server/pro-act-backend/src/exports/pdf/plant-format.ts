import { Decimal } from 'decimal.js';
import { Dec } from '../../domain/actuals/decimal';
import { currencyMinorUnits } from '../../domain/valuation/currency-minor-units';
import {
  CalendarSystem,
  DigitSystem,
} from '../../tenant/tenant-display-settings';

/** What the formatters need of the pinned presentation. */
export interface PlantFormat {
  timezone: string | null;
  calendar: CalendarSystem;
  digits: DigitSystem;
}

export const NO_VALUE = '—';
const PERSIAN_ZERO = 0x06f0;

/** `0-9` → Persian digits when the plant shows them (same rule as the frontend `toDigits`). */
export function toPlantDigits(text: string, digits: DigitSystem): string {
  if (digits !== 'persian') return text;
  return text.replace(/[0-9]/g, (d) =>
    String.fromCharCode(PERSIAN_ZERO + Number(d)),
  );
}

interface Parts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function partsOf(iso: string, format: PlantFormat): Parts | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const calendar = format.calendar === 'persian' ? 'persian' : 'gregory';
  const formatter = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
    timeZone: format.timezone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(instant);
  const read = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: read('year').replace(/\D/g, ''),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

/** Plant calendar date like the screens: `2026-10-12` (Gregorian) or `1405/07/20` (Persian). */
function datePart(p: Parts, calendar: CalendarSystem): string {
  return calendar === 'persian'
    ? `${p.year}/${p.month}/${p.day}`
    : `${p.year}-${p.month}-${p.day}`;
}

export function plantDate(iso: string | null, format: PlantFormat): string {
  const p = iso ? partsOf(iso, format) : null;
  return p
    ? toPlantDigits(datePart(p, format.calendar), format.digits)
    : NO_VALUE;
}

export function plantDateTime(iso: string | null, format: PlantFormat): string {
  const p = iso ? partsOf(iso, format) : null;
  if (!p) return NO_VALUE;
  const text = `${datePart(p, format.calendar)} ${p.hour}:${p.minute}`;
  return toPlantDigits(text, format.digits);
}

/** A half-open interval on the plant clock: `2026-10-12 06:00–14:00` or across days with both dates. */
export function plantRange(
  from: string,
  to: string,
  format: PlantFormat,
): string {
  const start = plantDateTime(from, format);
  const end = plantDateTime(to, format);
  const sameDay = plantDate(from, format) === plantDate(to, format);
  return sameDay
    ? `${start}–${end.slice(end.indexOf(' ') + 1)}`
    : `${start} – ${end}`;
}

function grouped(fixed: string): string {
  const [whole, fraction] = fixed.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = sign ? whole.slice(1) : whole;
  const withGroups = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction !== undefined
    ? `${sign}${withGroups}.${fraction}`
    : `${sign}${withGroups}`;
}

/**
 * A stored decimal for reading, like the screens (`formatDecimal`): rounded half away from zero to
 * `places`, grouped, plant digits and separators (`12,345.68` / `۱۲٬۳۴۵٫۶۸`); null → `—`.
 */
export function plantNumber(
  value: string | null,
  places: number,
  digits: DigitSystem,
): string {
  if (value === null || value === '') return NO_VALUE;
  const fixed = new Dec(value)
    .toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
    .toFixed(places);
  const text = grouped(fixed);
  if (digits !== 'persian') return text;
  const persian = text
    .replace(/,/g, String.fromCharCode(0x066c))
    .replace('.', String.fromCharCode(0x066b));
  return toPlantDigits(persian, digits);
}

/** `1,234.50 USD` / `1,234,568 IRR` (currency minor units, VAL03); null → `—`. */
export function plantMoney(
  amount: string | null,
  currency: string,
  digits: DigitSystem,
): string {
  if (amount === null) return NO_VALUE;
  return `${plantNumber(amount, currencyMinorUnits(currency), digits)} ${currency}`;
}
