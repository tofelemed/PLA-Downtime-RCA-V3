import type { StateSegmentView } from '@/api/v2/types/reliability';
import { humanize } from '@/features/ux-kit/labels';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { STATE_LABELS } from './mapping-editor-model';

/** The shared unit-state tokens (src/index.css `--state-*`, UX_AUDIT C-7); unknown stays a hatched gap. */
const STATE_CLASS: Readonly<Record<string, string>> = {
  running: 'bg-state-running',
  reduced_rate: 'bg-state-reduced',
  internal_stop: 'bg-state-stopped',
  planned_stop: 'bg-state-planned',
  starved: 'bg-state-starved',
  blocked: 'bg-state-blocked',
  standby: 'bg-state-idle',
  not_scheduled: 'bg-state-not-scheduled',
  unknown: 'bg-state-unknown bg-hatch-unknown',
};

const labelOf = (segment: StateSegmentView) =>
  segment.state === 'unknown'
    ? `Unknown (${humanize(segment.unknownReason ?? 'no_data')})`
    : (STATE_LABELS[segment.state as keyof typeof STATE_LABELS] ?? humanize(segment.state));

const msOf = (iso: string) => Date.parse(iso);

export interface StateTimelineProps {
  segments: StateSegmentView[];
  from: string;
  to: string;
  format: ReliabilityFormat;
}

/** The unit's state over the window as one bar; unknown time stays visible as a gap, never filled. */
export function StateTimeline({ segments, from, to, format }: StateTimelineProps) {
  const span = msOf(to) - msOf(from);
  const states = [...new Set(segments.map((s) => s.state))];
  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded border" role="img" aria-label="State timeline of the window">
        {segments.map((s) => (
          <div
            key={`${s.start}-${s.state}`}
            className={STATE_CLASS[s.state] ?? 'bg-muted'}
            style={{ width: `${span > 0 ? ((msOf(s.end) - msOf(s.start)) / span) * 100 : 0}%` }}
            title={`${labelOf(s)}: ${format.dateTime(s.start)} – ${format.dateTime(s.end)}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
        {states.map((state) => (
          <li key={state} className="flex items-center gap-1">
            <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${STATE_CLASS[state] ?? 'bg-muted'}`} />
            {state === 'unknown' ? 'Unknown (no data, stale, bad quality, unmapped)' : labelOf({ start: from, end: to, state, unknownReason: null })}
          </li>
        ))}
      </ul>
    </div>
  );
}
