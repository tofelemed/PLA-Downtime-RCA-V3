import type { UserView } from '@/api/v2/types/administration';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { roleLabel } from '@/features/ux-kit/labels';
import { UiIcon } from '@/lib/icons';
import { FromPlantBadge } from './from-plant-badge';
import { UserStatusBadge } from './user-status-badge';

/** Where a user belongs: its plant, else its organization, else "All plants" (super administrators). */
export function placeOf(user: UserView): string {
  return user.tenantName ?? user.organizationName ?? 'All plants';
}

/** Columns of the users table (name and e-mail, role, plant, status, open). */
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
  { id: 'role', header: 'Role', cell: (user) => roleLabel(user.role), nowrap: true },
  { id: 'place', header: 'Plant', cell: placeOf },
  { id: 'status', header: 'Status', cell: (user) => <UserStatusBadge isActive={user.isActive} />, nowrap: true },
  {
    id: 'open',
    header: <span className="sr-only">Open</span>,
    headerLabel: 'Open',
    cell: () => <UiIcon.next aria-hidden="true" className="h-4 w-4 text-muted-foreground" />,
    width: '2.5rem',
  },
];
