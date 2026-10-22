import { FriendlyErrorAlert, type FriendlyErrorAlertProps } from '../errors';
import { SaveFailureFrame } from './save-failure-frame';

export interface SaveFailureAlertProps extends Omit<FriendlyErrorAlertProps, 'error'> {
  /** the refused save; null / undefined renders nothing */
  error: unknown;
}

/**
 * The red alert of a refused save, for the top of a form or dialog: `FriendlyErrorAlert` in a
 * `SaveFailureFrame`, which scrolls into view and takes focus each time a new failure arrives, so a refusal
 * after "Create" at the bottom of a long form is never missed. The form keeps the user's input and marks
 * the refused fields itself.
 */
export function SaveFailureAlert({ error, className, ...rest }: SaveFailureAlertProps) {
  return (
    <SaveFailureFrame failure={error} className={className}>
      <FriendlyErrorAlert error={error} {...rest} />
    </SaveFailureFrame>
  );
}
