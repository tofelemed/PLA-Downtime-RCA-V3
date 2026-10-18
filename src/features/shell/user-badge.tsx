import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { IconButton } from '@/features/ux-kit/icon-button';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';
import { ActionIcon, EntityIcon } from '@/lib/icons';

/**
 * Signed-in user, their role in plain words, the read-only hint and the sign-out button (kept as the
 * last button of the header: e2e helpers and screen-reader users find it there).
 */
export function UserBadge() {
  const { session, logout } = useAuth();
  const { isReadOnly } = useCapabilities();
  if (!session) return null;
  return (
    <div className="flex items-center gap-2">
      <EntityIcon.user className="hidden h-5 w-5 text-muted-foreground sm:block" aria-hidden />
      <div className="hidden min-w-0 leading-tight md:block">
        <div className="truncate text-sm font-medium">{session.user.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{roleLabel(session.user.role)}</span>
          {isReadOnly && (
            <span
              className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-warning"
              title="Every role you hold in the selected plant is read-only; changes are refused by the server"
            >
              Read-only
            </span>
          )}
        </div>
      </div>
      <IconButton icon={ActionIcon.signOut} label="Sign out" onClick={() => void logout()} />
    </div>
  );
}
