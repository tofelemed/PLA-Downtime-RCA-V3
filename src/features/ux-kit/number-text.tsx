import { useNumberFormat } from './use-number-format';

export interface NumberTextProps {
  /** a JS number (count, length) or a decimal string from the API */
  value: number | string | null | undefined;
  fractionDigits?: number;
  className?: string;
}

/** A unitless number (`1,234`) in the plant's digits, for table cells and counts; null → "—". */
export function NumberText({ value, fractionDigits = 0, className }: NumberTextProps) {
  const { decimal, number } = useNumberFormat();
  const text = typeof value === 'number' ? number(value, fractionDigits) : decimal(value, fractionDigits);
  return <span className={className}>{text}</span>;
}
