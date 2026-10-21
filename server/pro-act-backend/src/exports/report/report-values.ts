import { Dec } from '../../domain/actuals/decimal';
import {
  NO_VALUE,
  plantDate,
  plantDateTime,
  PlantFormat,
  plantMoney,
  plantNumber,
  toPlantDigits,
} from '../pdf/plant-format';
import { ReportCell, ReportValueType } from './report-document';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Solar Hijri month names, as the screens write them (`src/lib/dates/plant-month.ts`). */
const JALALI_MONTHS = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
];

export interface CellFormat {
  type: ReportValueType;
  places?: number;
  unit?: string;
}

/** Seconds as `12 h 05 min` (`45 min` under an hour; `—` for nothing). */
export function durationText(
  seconds: string | number,
  format: PlantFormat,
): string {
  const total = Math.round(Number(seconds) / 60);
  if (!Number.isFinite(total)) return NO_VALUE;
  const sign = total < 0 ? '-' : '';
  const minutes = Math.abs(total);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const text =
    h > 0 ? `${grouped(h)} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  return toPlantDigits(`${sign}${text}`, format.digits);
}

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A plant date `YYYY-MM-DD` on the plant's calendar (read at noon UTC, so no zone can move the day). */
function localDate(value: string, format: PlantFormat): string {
  return plantDate(`${value}T12:00:00Z`, { ...format, timezone: 'UTC' });
}

/**
 * A plant month key as words: the server keys a Persian-calendar plant's months in that calendar
 * (`1405-07` = Mehr 1405; settings audit, 21 Oct 2026), every other plant's in the Gregorian one.
 */
function month(value: string, format: PlantFormat): string {
  const [year, m] = value.split('-');
  const names = format.calendar === 'persian' ? JALALI_MONTHS : MONTHS;
  const name = names[Number(m) - 1];
  return name ? toPlantDigits(`${name} ${year}`, format.digits) : value;
}

/** A plant date (`YYYY-MM-DD`) for a title or sentence, on the plant's calendar and digits. */
export const plantDayText = (isoDate: string, format: PlantFormat): string =>
  localDate(isoDate, format);

/** A month key (`YYYY-MM`, in `format.calendar`) for a title or sentence: "Mehr 1405" / "Oct 2026". */
export const plantMonthText = (key: string, format: PlantFormat): string =>
  month(key, format);

/** A cell as printed in the PDF, on the plant's calendar, clock and digits. */
export function printCell(
  value: ReportCell,
  cell: CellFormat,
  format: PlantFormat,
): string {
  if (value === null || value === '') return NO_VALUE;
  const text = String(value);
  switch (cell.type) {
    case 'number':
      return plantNumber(text, cell.places ?? 1, format.digits);
    case 'percent':
      return `${plantNumber(new Dec(text).mul(100).toString(), cell.places ?? 1, format.digits)} %`;
    case 'duration':
      return durationText(text, format);
    case 'money':
      return plantMoney(text, cell.unit ?? '', format.digits);
    case 'date':
      return localDate(text, format);
    case 'month':
      return month(text, format);
    case 'datetime':
      return plantDateTime(text, format);
    default:
      return text;
  }
}
