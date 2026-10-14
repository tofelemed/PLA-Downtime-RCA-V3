import { useCalendarPreference } from '@/lib/dates';
import { DurationStyle, formatDuration, toSeconds } from './format/duration';

export interface DurationTextProps {
  /** seconds, as the API sends them (number or decimal string) */
  seconds: number | string | null | undefined;
  /** C1: `compact` in lists (minutes), `clock` in KPI tiles (h:mm), `long` elsewhere */
  variant?: DurationStyle;
  className?: string;
}

/** The only component that turns seconds into duration text (plan 3.1); digits follow the plant setting. */
export function DurationText({ seconds, variant = 'long', className }: DurationTextProps) {
  const { digits } = useCalendarPreference();
  const value = toSeconds(seconds);
  return (
    <span className={className} title={value === null ? undefined : `${value} s`}>
      {formatDuration(value, variant, digits)}
    </span>
  );
}
