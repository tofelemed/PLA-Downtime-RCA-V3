import type { UserView } from '@/api/v2/types/administration';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { roleLabel, roleListLabel } from '@/features/ux-kit/labels';
import { UiIcon } from '@/lib/icons';
import { FromPlantBadge } from './from-plant-badge';
import { UserStatusBadge } from './user-status-badge';

/** Where a user belongs: its plant, else its organization, else "All plants" (super administrators). */
export function placeOf(user: UserView): string {
  return user.tenantName ?? user.organizationName ?? 'All plants';
}

/**
 * The roles that decide what the user sees in the acting plant (QA audit 2026-10-19), not the legacy
 * sign-in role ("Analyst"); a server without `plantRoles` falls back to the legacy role.
 */
export function plantRolesText(user: UserView): string {
  return user.plantRoles ? roleListLabel(user.plantRoles) : roleLabel(user.role);
}

/**
 * Columns of the users table (name and e-mail, plant roles, status, open). No plant column (cleanup 25 Oct 2026):
 * it repeats the selected plant on every row; a user from another plant carries the "From <home plant>" badge.
 */
export const USER_COLUMNS: ReadonlyArray<DataTableColumn<UserView>> = [
  {
    id: 'name',
    header: 'Name',
    cell: (user) => (
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {user.name}
          <FromPlantBadge user={user} />
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    ),
  },
  { id: 'role', header: 'Plant roles', cell: plantRolesText },
  { id: 'status', header: 'Status', cell: (user) => <UserStatusBadge isActive={user.isActive} />, nowrap: true },
  {
    id: 'open',
    header: <span className="sr-only">Open</span>,
    headerLabel: 'Open',
    cell: () => <UiIcon.next aria-hidden="true" className="h-4 w-4 text-muted-foreground" />,
    width: '2.5rem',
  },
];
