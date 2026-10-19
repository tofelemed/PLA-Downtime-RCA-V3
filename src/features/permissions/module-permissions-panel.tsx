import { Link } from 'react-router-dom';
import type { UserView } from '@/api/v2/types/administration';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { useMenuFlags } from '@/features/shell/use-menu-flags';
import { roleListLabel } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { EntityIcon, StatusIcon } from '@/lib/icons';
import { sidebarNameOf } from '@/features/auth/navigation-items';
import { reachableModules, userRolesInPlant } from './reachable-modules';

export interface ModulePermissionsPanelProps {
  user: UserView | null;
}

/**
 * Read-only list of the menu pages a user reaches in the selected plant, derived from the user's plant
 * roles exactly like the menu (QA audit 2026-10-19). Nothing here is stored: access changes through the
 * access grants on the user's page, which the note links.
 */
export function ModulePermissionsPanel({ user }: ModulePermissionsPanelProps) {
  return (
    <Section
      title="Module permissions"
      headingLevel={2}
      description={user ? `What ${user.name} reaches in this plant` : 'Select a user to see the modules they reach'}
    >
      {user ? (
        <ReachableModules user={user} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <EntityIcon.permission aria-hidden="true" className="h-10 w-10 opacity-50" />
          <p>Select a user to see their permissions</p>
        </div>
      )}
    </Section>
  );
}

function ReachableModules({ user }: { user: UserView }) {
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  const acting = selection?.tenant?.id || session?.tenant?.id || null;
  const groups = reachableModules(userRolesInPlant(user, acting), useMenuFlags());
  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="modules-none">{user.name} reaches no page in this plant.</p>
      ) : (
        <ul className="space-y-3" aria-label={`Modules reached by ${user.name}`} data-testid="reachable-modules">
          {groups.map((group) => (
            <li key={group.section.key}>
              <p className="text-sm font-medium">{group.section.label}</p>
              <p className="text-sm text-muted-foreground">{group.items.map(sidebarNameOf).join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
      <Alert data-testid="permissions-read-only-note">
        <StatusIcon.info aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Per-user permission overrides are not stored</AlertTitle>
        <AlertDescription>
          <p>
            This is the menu of <strong>{roleListLabel(user.plantRoles ?? [user.role])}</strong> in this plant; the server decides from the
            user’s roles and access grants. Grant or remove access on the user’s page.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to={`/users/${user.id}`}>Open user and access</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
