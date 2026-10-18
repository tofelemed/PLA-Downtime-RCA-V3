import type { SourceSegmentView } from '@/api/v2/types/periods';
import { labelOf, segmentMethodLabel } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ACTUALS_METHOD_LABELS, ACTUALS_SOURCE_LABELS, SEGMENT_QUALITY_LABELS } from '../model/actuals-labels';
import { groupSegments, type SegmentGroup } from '../model/segment-groups';

export interface SourceSegmentGroupsProps {
  segments: readonly SourceSegmentView[];
  uom: string | null;
  timezone: string;
  /** the slice's coverage text from the server (shown on a single-source summary) */
  coverageText: string;
  signalName: (signalId: string) => string | null;
}

function sourceName(group: SegmentGroup, signalName: SourceSegmentGroupsProps['signalName']): string {
  if (group.signalId) return signalName(group.signalId) ?? 'Signal (name not available)';
  return labelOf(ACTUALS_SOURCE_LABELS, group.source);
}

/** A period-level method has its own words; a signal segment method names engine, interpolation and kind. */
function methodText(method: string): string {
  const known = Object.prototype.hasOwnProperty.call(ACTUALS_METHOD_LABELS, method);
  return (known ? ACTUALS_METHOD_LABELS[method] : segmentMethodLabel(method)).toLowerCase();
}

function GroupSummary({ group, name, coverage }: { group: SegmentGroup; name: string; coverage: string | null }) {
  const { number } = useNumberFormat();
  const qualities = Object.entries(group.qualityCounts)
    .map(([quality, count]) => `${number(count)} ${labelOf(SEGMENT_QUALITY_LABELS, quality)}`)
    .join(', ');
  return (
    <span data-testid="segment-group-summary">
      {name} · {methodText(group.method)}
      {coverage ? ` · coverage ${coverage}` : ''} · {number(group.segments.length)} segments ({qualities})
    </span>
  );
}

/**
 * The actuals' source segments grouped per source (signal name, method, coverage, segment count), each
 * with its segments behind an expandable detail; the quantities are the server's, per segment.
 */
export function SourceSegmentGroups({ segments, uom, timezone, coverageText, signalName }: SourceSegmentGroupsProps) {
  const groups = groupSegments(segments);
  return (
    <div className="space-y-1 text-xs" data-testid="segment-groups">
      {groups.map((group) => (
        <details key={`${group.source}|${group.method}`} data-testid="segment-group">
          <summary className="cursor-pointer">
            <GroupSummary group={group} name={sourceName(group, signalName)} coverage={groups.length === 1 ? coverageText : null} /> · <PlantTime iso={group.from} tz={timezone} /> →{' '}
            <PlantTime iso={group.to} tz={timezone} />
          </summary>
          <ul className="list-disc pl-5">
            {group.segments.map((s) => (
              <li key={`${s.from}-${s.to}`}>
                <PlantTime iso={s.from} tz={timezone} /> → <PlantTime iso={s.to} tz={timezone} /> · {labelOf(SEGMENT_QUALITY_LABELS, s.quality)} · <Quantity value={s.quantity} uom={uom} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
