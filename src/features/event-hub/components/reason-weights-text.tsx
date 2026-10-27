import type { ReasonWeightView } from '@/api/v2/types/events';
import { percentOf } from '../model/reason-split';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv } from '../use-event-hub-env';

function ShareText({ weight, uom }: { weight: ReasonWeightView; uom: string | null }) {
  const numbers = useNumberFormat();
  if (weight.quantity) return <Quantity value={weight.quantity} uom={uom} fractionDigits={3} className="text-muted-foreground" />;
  return <span className="text-muted-foreground">{numbers.text(`${percentOf(weight.weight, 2)} %`)}</span>;
}

/**
 * D-T5: a stop split across reasons, as stored: "Motor 75 % · Belt 25 %" (largest first, the stop's reason).
 * Declared mode: a production loss shows each share in tonnes (server figures), a recovery share as
 * "Recovery · <reason> · 8 t" (Task 13).
 */
export function ReasonWeightsText({ weights, uom = null }: { weights: readonly ReasonWeightView[]; uom?: string | null }) {
  const env = useEventHubEnv();
  return (
    <ul className="space-y-0.5" data-testid="reason-weights">
      {weights.map((w) => (
        <li key={w.reasonCodeId} data-testid={w.recovery ? 'reason-weight-recovery' : 'reason-weight'}>
          {w.recovery ? `Recovery · ${env.reasonName(w.reasonCodeId)} · ` : `${env.reasonName(w.reasonCodeId)} `}
          <ShareText weight={w} uom={uom} />
        </li>
      ))}
    </ul>
  );
}
