import type { ReasonWeightView } from '@/api/v2/types/events';
import { percentOf } from '../model/reason-split';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '../use-event-hub-env';

/** D-T5: a stop split across reasons, as stored: "Motor 75 % · Belt 25 %" (largest first, the stop's reason). */
export function ReasonWeightsText({ weights }: { weights: readonly ReasonWeightView[] }) {
  const env = useEventHubEnv();
  const numbers = useNumberFormat();
  return (
    <ul className="space-y-0.5" data-testid="reason-weights">
      {weights.map((w) => (
        <li key={w.reasonCodeId}>
          {env.reasonName(w.reasonCodeId)} <span className="text-muted-foreground">{numbers.text(`${percentOf(w.weight, 2)} %`)}</span>
        </li>
      ))}
    </ul>
  );
}
