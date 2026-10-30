import type { ProductionEventView } from '@/api/v2/types/events';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import type { ReasonSplitState } from '../hooks/use-reason-split';
import { hasSplit } from '../model/reason-split';
import { SPLIT_LOCKED, SPLIT_LOCKED_ID, splitLocked } from '../model/split-lock';
import { ReasonCodeSelect } from './reason-code-select';
import { ReasonSplitSection } from './reason-split-section';
import { ReasonWeightsText } from './reason-weights-text';

export interface ReasonChoiceProps {
  event: ProductionEventView;
  split: ReasonSplitState;
  reasonCodeId: string;
  onReason: (value: string) => void;
  /** id of the single-reason picker (the dialog's `code-reason`, the edit page's `reasonCodeId`) */
  selectId?: string;
  error?: string;
  /** edit page: "no reason" clears the code */
  allowEmpty?: boolean;
}

/**
 * The reason part of the code dialog and the edit page: one reason, or (for the roles that may) a split
 * across several (D-T5). A split the user may not change is shown as stored, with why it is closed to them.
 */
export function ReasonChoice({ event, split, reasonCodeId, onReason, selectId = 'code-reason', error, allowEmpty = false }: ReasonChoiceProps) {
  const { canSplitReasons } = useCapabilities();
  if (splitLocked(event, canSplitReasons) && hasSplit(event.reasonWeights)) {
    return (
      <div className="space-y-1" data-testid="split-locked">
        <ReasonWeightsText weights={event.reasonWeights} uom={event.quantityUom ?? event.declaredFigures?.uom ?? null} />
        <DisabledReason id={SPLIT_LOCKED_ID} reason={SPLIT_LOCKED} />
      </div>
    );
  }
  return (
    <>
      {!split.enabled && <ReasonCodeSelect id={selectId} value={reasonCodeId} onChange={onReason} error={error} allowEmpty={allowEmpty} />}
      {canSplitReasons && <ReasonSplitSection split={split} />}
    </>
  );
}
