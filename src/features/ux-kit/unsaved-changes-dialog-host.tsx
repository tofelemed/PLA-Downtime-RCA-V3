import { useEffect, useSyncExternalStore } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import { pendingLeaveMessage, registerLeaveHost, settleLeave, subscribeLeave } from './leave-confirmation';

/**
 * The app's "unsaved changes" dialog: answers `useUnsavedChangesGuard`'s in-app navigation questions
 * (links, back / forward, Cancel). Mount once near the root; closing or reloading the tab keeps the
 * browser's own prompt.
 */
export function UnsavedChangesDialogHost() {
  const message = useSyncExternalStore(subscribeLeave, pendingLeaveMessage, pendingLeaveMessage);
  useEffect(() => registerLeaveHost(), []);
  return (
    <ConfirmDialog
      open={message !== null}
      onOpenChange={(open) => !open && settleLeave(false)}
      title="Leave this page?"
      description={message ?? undefined}
      confirmLabel="Leave and discard"
      cancelLabel="Stay on this page"
      destructive
      onConfirm={() => settleLeave(true)}
    />
  );
}
