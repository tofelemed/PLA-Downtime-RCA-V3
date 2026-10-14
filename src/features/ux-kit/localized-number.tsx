import { useNumberFormat } from './use-number-format';

export interface LocalizedNumberProps {
  /** number text formatted in Latin digits by a shared helper (`"87.5 %"`, `"1,234.50 USD"`) */
  text: string;
  className?: string;
}

/**
 * Latin number text in the plant's digits, for table cells built outside a component (column
 * definitions): `<LocalizedNumber text={shareText(group.share)} />`. Never wrap identifiers in it.
 */
export function LocalizedNumber({ text, className }: LocalizedNumberProps) {
  const localized = useNumberFormat().text(text);
  return className ? <span className={className}>{localized}</span> : <>{localized}</>;
}
