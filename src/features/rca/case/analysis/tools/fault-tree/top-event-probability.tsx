import type { FaultTreeRecord } from '@/api/v2/types/rca-analyses';
import { formatSignificant } from '@/features/ux-kit/format/decimal';
import { useCalendarPreference } from '@/lib/dates';

const REASONS: Readonly<Record<string, string>> = {
  probability_missing: 'a basic event has no probability',
  no_single_top_event: 'the tree needs exactly one top node',
  not_a_tree: 'some nodes are not connected to the top node, or form a loop',
  gate_without_inputs: 'a gate has no inputs',
  ambiguous_event: 'an intermediate event has several inputs without a gate',
};

type Result = Pick<FaultTreeRecord, 'topEventProbability' | 'topEventProbabilityReason'>;

/** RCA-06: the top-event probability the server computed for the saved tree (independent basic events). */
export function TopEventProbability({ record }: { record: Result | null }) {
  const { digits } = useCalendarPreference();
  if (!record) return null;
  const { topEventProbability: p, topEventProbabilityReason: reason } = record;
  const text = p === null ? `Not available: ${REASONS[reason ?? ''] ?? 'the tree cannot be computed'}` : `${formatSignificant(p * 100, 4, digits)} %`;
  return (
    <p className="text-sm" data-testid="ft-top-probability">
      Probability of the top event (saved tree, independent basic events): <span className="font-medium">{text}</span>
    </p>
  );
}
