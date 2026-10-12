import { useUpdateUser } from '@/api/v2/queries/administration-users';
import type { UserView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { StatusIcon } from '@/lib/icons';

/** "Deactivate user" (confirmed: the user can no longer sign in) or "Activate user" (immediate). */
export function UserActivationButton({ user }: { user: UserView }) {
  const update = useUpdateUser();
  const feedback = useCommandFeedback();
  const setActive = (isActive: boolean) =>
    feedback(() => update.submit({ id: user.id, body: { isActive } }), isActive ? 'User activated' : 'User deactivated');
  if (!user.isActive) {
    return (
      <Button variant="outline" onClick={() => void setActive(true).catch(() => undefined)} disabled={update.isPending}>
        Activate user
      </Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <StatusIcon.locked aria-hidden="true" />
          Deactivate user
        </Button>
      }
      title={`Deactivate ${user.name}?`}
      description="The user can no longer sign in. Tasks and history keep the name; you can activate the user again."
      confirmLabel="Deactivate user"
      destructive
      onConfirm={() => setActive(false)}
    />
  );
}
