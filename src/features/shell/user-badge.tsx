import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon, EntityIcon } from '@/lib/icons';
import { plantRoleSummary } from './plant-role-summary';

/**
 * Signed-in user, their roles in the selected plant in plain words (QA audit 2026-10-19), the read-only hint and the sign-out button (kept as the
 * last button of the header: e2e helpers and screen-reader users find it there).
 */
export function UserBadge() {
  const { session, logout } = useAuth();
  const { isReadOnly, roles } = useCapabilities();
  if (!session) return null;
  const plantRoles = plantRoleSummary(roles, session.user.role);
  return (
    <div className="flex items-center gap-2">
      {/* QA_MASTERDATA L27: below lg the name and roles fold into the icon's tooltip so the plant scope stays readable */}
      <span className="hidden sm:block" title={`${session.user.name} · ${plantRoles.full}`}>
        <EntityIcon.user className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div className="hidden min-w-0 leading-tight lg:block">
        <div className="truncate text-sm font-medium">{session.user.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate" title={plantRoles.full} data-testid="user-plant-roles">{plantRoles.short}</span>
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
