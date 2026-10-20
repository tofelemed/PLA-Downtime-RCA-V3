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

function month(value: string, format: PlantFormat): string {
  const [year, m] = value.split('-');
  const name = MONTHS[Number(m) - 1];
  return name ? toPlantDigits(`${name} ${year}`, format.digits) : value;
}

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
