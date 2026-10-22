/**
 * Save feedback standard (DECISIONS 2026-10-22, plans/SETUP_UX_FIXES.md Phase 2):
 * - creates, new versions, imports → result dialog (`useSaveFeedback().run(work, (saved) => SaveResult)`,
 *   or `useSaveResult` / `SaveResultDialog` directly), with `nextSetupLink` for "Next: <page>";
 * - small edits, approvals → toast (`useSaveFeedback().run(work, 'Unit updated')`, or `useCommandFeedback`
 *   for buttons and confirmations);
 * - failures → red alert at the top of the form (`SaveFailureAlert`, `useSaveFeedback().alert`; an area's own
 *   alert inside `SaveFailureFrame` or `useSaveFeedback(fields, renderAlert)`), refused
 *   fields marked on their inputs, input kept.
 */
export { saveResultActions, type SaveAction, type SaveActionId, type SaveLink, type SaveResult } from './save-result';
export { SaveResultDialog, type SaveResultDialogProps } from './save-result-dialog';
export { useSaveResult, type SaveResultHandle } from './use-save-result';
export { SaveFailureAlert, type SaveFailureAlertProps } from './save-failure-alert';
export { SaveFailureFrame, type SaveFailureFrameProps } from './save-failure-frame';
export { useSaveFeedback, type SaveFeedback, type SaveSuccess } from './use-save-feedback';
export { useCommandFeedback } from './use-command-feedback';
export { nextSetupLink, type NextSetupLinkOptions } from './next-setup-link';
