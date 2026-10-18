import { useCalendarPreference } from '@/lib/dates';
import { DurationStyle, formatDuration, toSeconds } from './format/duration';

export interface DurationTextProps {
  /** seconds, as the API sends them (number or decimal string) */
  seconds: number | string | null | undefined;
  /** @deprecated ignored — one duration format everywhere (UX audit C-3) */
  variant?: DurationStyle;
  className?: string;
}

/**
 * The only component that turns seconds into duration text (plan 3.1): "42 min" / "3 h 25 min" /
 * "2 d 11 h", digits follow the plant setting, the exact seconds are in the tooltip.
 */
export function DurationText({ seconds, className }: DurationTextProps) {
  const { digits } = useCalendarPreference();
  const value = toSeconds(seconds);
  return (
    <span className={className} title={value === null ? undefined : `${value} s`}>
      {formatDuration(value, 'long', digits)}
    </span>
  );
}
