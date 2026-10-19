import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { plural } from '@/features/ux-kit/format/plural';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { formatRatioPercent } from '../model/display';

function verdict(gate: CodingGateView): string {
  if (gate.passes) return 'Day stop coding complete';
  return gate.mode === 'block' ? 'Day stop coding incomplete — certification is blocked' : 'Day stop coding incomplete — shown as a warning';
}

/**
 * SME D12 daily target on the production day: the server's verdict over the day's stops (a reason or
 * "investigation pending" each, coded stop time against the daily target, pilot 99 %). Nothing is computed
 * here; a day without stops shows nothing. Styled like the shift's coding card (QA: the day warning was plain grey text).
 */
export function DayCodingGate({ gate }: { gate: CodingGateView | null }) {
  const { number, digits } = useNumberFormat();
  if (!gate || gate.stops === 0) return null;
  return (
    <div className={`space-y-1 rounded-md border p-3 text-sm ${gate.passes ? '' : 'border-warning/40'}`} data-testid="day-coding-gate" data-passes={gate.passes} data-mode={gate.mode}>
      <p className="font-medium">{verdict(gate)}</p>
      <p>
        {plural(gate.stops, 'stop', 'stops', number)}, {number(gate.uncoded)} uncoded · coded stop time {formatRatioPercent(gate.codedRatio, digits)} (daily target{' '}
        {formatRatioPercent(gate.target, digits)})
      </p>
    </div>
  );
}
