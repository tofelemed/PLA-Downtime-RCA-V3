import { useNavigate } from 'react-router-dom';
import { useDeleteUser } from '@/api/v2/queries/administration-users';
import type { UserView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ActionIcon } from '@/lib/icons';
import { UserActivationButton } from './user-activation-button';

/** Deactivate (confirmed) or activate a user, and delete it (confirmed); for users the caller may manage. */
export function UserLifecycleActions({ user, isSelf }: { user: UserView; isSelf: boolean }) {
  const navigate = useNavigate();
  const remove = useDeleteUser();
  const feedback = useCommandFeedback();
  if (isSelf) {
    return <p className="text-sm text-muted-foreground">You cannot deactivate or delete your own account.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <UserActivationButton user={user} />
      <ConfirmDialog
        trigger={
          <Button variant="destructive">
            <ActionIcon.delete aria-hidden="true" />
            Delete user
          </Button>
        }
        title={`Delete ${user.name}?`}
        description="The user and its access grants are removed for good. Deactivate instead if the history should keep a name."
        confirmLabel="Delete user"
        destructive
        onConfirm={async () => {
          await feedback(() => remove.submit(user.id), 'User deleted');
          navigate('/users');
        }}
      />
    </div>
  );
}
