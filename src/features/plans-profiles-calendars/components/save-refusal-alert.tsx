import { SaveFailureFrame } from '@/features/ux-kit/save-result';
import { RefusalNotice, type RefusalNoticeProps } from './refusal-notice';

export interface SaveRefusalAlertProps extends RefusalNoticeProps {
  className?: string;
}

/**
 * The red alert of a refused save or command in this area (DECISIONS 2026-10-22 "Save feedback"):
 * `RefusalNotice` in the kit's `SaveFailureFrame` — at the top of the form or dialog, scrolled into view and
 * focused for each new failure, input kept. `RefusalNotice` adds what planning refusals need: the
 * conflicting versions of an overlap with their plant-time intervals and "Reload" after a stale edit. One
 * red box, one channel: no error toast.
 */
export function SaveRefusalAlert({ error, className, ...rest }: SaveRefusalAlertProps) {
  return (
    <SaveFailureFrame failure={error} className={className}>
      <RefusalNotice error={error} {...rest} />
    </SaveFailureFrame>
  );
}
