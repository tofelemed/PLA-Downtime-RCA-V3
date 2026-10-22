import { useCallback, useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { FieldVocabulary } from '../errors';
import type { SaveResult } from './save-result';
import { SaveFailureAlert } from './save-failure-alert';
import { SaveFailureFrame } from './save-failure-frame';
import { useSaveResult } from './use-save-result';

/**
 * How a success is reported: a toast title (small edits), the result dialog built from the saved value, or
 * null when the caller shows its own result (e.g. a `SaveResultDialog` with an action of its own).
 */
export type SaveSuccess<T> = string | ((saved: T) => SaveResult) | null;

export interface SaveFeedback {
  /**
   * Runs the save. Success → toast (string), result dialog (function) or nothing (null); failure → `failure` is set for the
   * red alert and the error is rethrown, so the caller can mark fields and keep the input.
   */
  run: <T>(work: () => Promise<T>, success: SaveSuccess<T>) => Promise<T>;
  /** the last refused save, until the next `run` or `clearFailure` */
  failure: unknown;
  clearFailure: () => void;
  /** `SaveFailureAlert` of `failure` (or the `renderAlert` one): render it at the top of the form or dialog */
  alert: ReactNode;
  /** the result dialog: render it once anywhere in the component */
  dialog: ReactNode;
  /** shows the result dialog directly (e.g. after a multi-step save) */
  openResult: (result: SaveResult) => void;
}

/**
 * The save feedback standard for forms (DECISIONS 2026-10-22): creates, new versions and imports end in
 * the result dialog, small edits in a toast, and every failure in a red alert at the top of the form (one
 * channel, no error toast). Buttons and confirmations without a form keep `useCommandFeedback`.
 * `fields` names the form's fields in the alert ("Time zone: …" instead of "timezone"); `renderAlert` replaces
 * the kit's alert with an area's richer one, still inside the focusing `SaveFailureFrame`.
 *
 * @example
 * const feedback = useSaveFeedback();
 * await feedback.run(() => create.submit(body), (unit) => ({ title: 'Unit created', recordLabel: unit.name,
 *   viewPath: `/master-data/units/${unit.id}`, viewLabel: 'View unit', listPath: '/master-data/units',
 *   listLabel: 'Production units', next: nextSetupLink('/master-data/units', { unitId: unit.id }) }));
 * return <form>{feedback.alert}…{feedback.dialog}</form>;
 */
export function useSaveFeedback(fields?: FieldVocabulary, renderAlert?: (failure: unknown) => ReactNode): SaveFeedback {
  const { toast } = useToast();
  const result = useSaveResult();
  const openResult = result.open;
  const [failure, setFailure] = useState<unknown>(null);
  const run = useCallback(
    async <T,>(work: () => Promise<T>, success: SaveSuccess<T>): Promise<T> => {
      setFailure(null);
      try {
        const saved = await work();
        if (typeof success === 'string') toast({ title: success });
        else if (success) openResult(success(saved));
        return saved;
      } catch (error) {
        setFailure(error);
        throw error;
      }
    },
    [toast, openResult],
  );
  const clearFailure = useCallback(() => setFailure(null), []);
  const alert = renderAlert ? (
    <SaveFailureFrame failure={failure}>{renderAlert(failure)}</SaveFailureFrame>
  ) : (
    <SaveFailureAlert error={failure} fields={fields} />
  );
  return { run, failure, clearFailure, alert, dialog: result.element, openResult };
}
