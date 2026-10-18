import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** E-1 presets of the "Min duration" filter, in seconds. */
const MIN_DURATION_PRESETS: ReadonlyArray<{ seconds: number; label: string }> = [
  { seconds: 5 * 60, label: '≥ 5 min' },
  { seconds: 30 * 60, label: '≥ 30 min' },
  { seconds: 2 * 3600, label: '≥ 2 h' },
];

export interface MinDurationSelectProps {
  value: number | null;
  onChange: (seconds: number | null) => void;
}

/**
 * E-1: only events lasting at least a duration (sent as `minDurationSeconds`; a running stop counts by the
 * time elapsed so far — the server's rule). A value from a shared link that is not a preset stays listed.
 */
export function MinDurationSelect({ value, onChange }: MinDurationSelectProps) {
  const { number } = useNumberFormat();
  const custom = value !== null && !MIN_DURATION_PRESETS.some((preset) => preset.seconds === value);
  return (
    <select
      aria-label="Min duration"
      data-testid="filter-min-duration"
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={value === null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      <option value="">Any duration</option>
      {MIN_DURATION_PRESETS.map((preset) => (
        <option key={preset.seconds} value={String(preset.seconds)}>
          {preset.label}
        </option>
      ))}
      {custom && <option value={String(value)}>≥ {number(Math.round(value / 60))} min</option>}
    </select>
  );
}
