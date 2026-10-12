import { Link } from 'react-router-dom';
import type { UserView } from '@/api/v2/types/administration';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { roleLabel } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { EntityIcon, StatusIcon } from '@/lib/icons';
import { defaultPermissionsFor, MODULE_LABELS, type ModulePermissions } from './role-permission-defaults';

export interface ModulePermissionsPanelProps {
  user: UserView | null;
}

/**
 * Read-only matrix of the modules a user's role reaches. Nothing here is stored: per-user overrides do not
 * exist; access changes through the role and the access grants on the user's page, which the note links.
 */
export function ModulePermissionsPanel({ user }: ModulePermissionsPanelProps) {
  return (
    <Section
      title="Module permissions"
      headingLevel={2}
      description={user ? `What the role of ${user.name} reaches by default` : 'Select a user to see the modules their role reaches'}
    >
      {user ? (
        <PermissionMatrix user={user} permissions={defaultPermissionsFor(user.role)} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <EntityIcon.permission aria-hidden="true" className="h-10 w-10 opacity-50" />
          <p>Select a user to see their permissions</p>
        </div>
      )}
    </Section>
  );
}

function PermissionMatrix({ user, permissions }: { user: UserView; permissions: ModulePermissions }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-label={`Modules reached by ${user.name}`}>
        {(Object.keys(MODULE_LABELS) as Array<keyof ModulePermissions>).map((module) => (
          <li key={module} className="flex items-center justify-between">
            <Label htmlFor={`module-${module}`}>{MODULE_LABELS[module]}</Label>
            <Switch id={`module-${module}`} checked={permissions[module]} disabled aria-readonly="true" />
          </li>
        ))}
      </ul>
      <Alert data-testid="permissions-read-only-note">
        <StatusIcon.info aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Per-user permission overrides are not stored</AlertTitle>
        <AlertDescription>
          <p>
            This shows what the role <strong>{roleLabel(user.role)}</strong> reaches by default; the server decides from the user’s roles and
            access grants. Change the role or grant access on the user’s page.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to={`/users/${user.id}`}>Open user and access</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
