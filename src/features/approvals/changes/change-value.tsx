import type { ReactNode } from 'react';
import type { ApprovalChangeField } from '@/api/v2/types/approvals';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat, type NumberFormat } from '@/features/ux-kit/use-number-format';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { fractionDigitsOf, wordsOf } from './change-format';

interface Formatters {
  timezone: string;
  pref: ReturnType<typeof useCalendarPreference>;
  numbers: NumberFormat;
}
type Render = (field: ApprovalChangeField, value: string, f: Formatters) => ReactNode;

const withUnit = (text: string, unit: string | null) => <span>{text}{unit && <span className="ml-1 text-muted-foreground">{unit}</span>}</span>;

/** One renderer per server format, so every value reads as it does elsewhere in the app. */
const RENDER: Record<ApprovalChangeField['format'], Render> = {
  quantity: (field, value) => <Quantity value={value} uom={field.unit} fractionDigits={Math.max(2, fractionDigitsOf(value))} />,
  money: (field, value, f) => withUnit(field.currency ? formatCurrencyAmount(value, field.currency, f.pref.digits) : f.numbers.decimal(value), field.unit),
  number: (field, value, f) => withUnit(f.numbers.decimal(value, fractionDigitsOf(value)), field.unit),
  instant: (_field, value, f) => <PlantTime iso={value} tz={f.timezone} withDate />,
  date: (_field, value, f) => <span>{formatOperationalDate(value, f.pref)}</span>,
  duration: (_field, value) => <DurationText seconds={value} />,
  boolean: (_field, value) => <span>{value === 'true' ? 'Yes' : 'No'}</span>,
  text: (_field, value) => <span className="whitespace-pre-wrap break-words">{wordsOf(value)}</span>,
};

/** One side of a changed field, formatted like everywhere else: plant digits, plant time, units, currency. */
export function ChangeValue({ field, value }: { field: ApprovalChangeField; value: string | null }) {
  const { timezone } = usePlantTimezone();
  const pref = useCalendarPreference();
  const numbers = useNumberFormat();
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <>{(RENDER[field.format] ?? RENDER.text)(field, value, { timezone, pref, numbers })}</>;
}
