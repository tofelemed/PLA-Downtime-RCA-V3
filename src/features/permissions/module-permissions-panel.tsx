import { Link } from 'react-router-dom';
import { Info, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { UserRecord } from '@/services/api/userApi';
import { defaultPermissionsFor, MODULE_LABELS, type ModulePermissions } from './role-permission-defaults';

export interface ModulePermissionsPanelProps {
  user: UserRecord | null;
}

/**
 * Read-only matrix of the modules a user's role reaches. There is no API that stores per-user permission
 * overrides (the users endpoints carry name, role, plant and status only), so nothing here can be saved:
 * the switches are disabled and the note sends the administrator to User Management, where the role is
 * changed. The matrix must never pretend to persist (it used to write an audit row and report success).
 */
export function ModulePermissionsPanel({ user }: ModulePermissionsPanelProps) {
  const permissions = user ? defaultPermissionsFor(user.role) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Module Permissions
        </CardTitle>
        <CardDescription>
          {user ? `Managing permissions for ${user.name}` : 'Select a user to see the modules their role reaches'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user && permissions ? (
          <PermissionMatrix user={user} permissions={permissions} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a user to see their permissions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PermissionMatrix({ user, permissions }: { user: UserRecord; permissions: ModulePermissions }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="font-medium">{user.name}</p>
        <p className="text-sm text-gray-500">Role: {user.role}</p>
      </div>

      <div className="space-y-3">
        {(Object.keys(MODULE_LABELS) as Array<keyof ModulePermissions>).map((module) => (
          <div key={module} className="flex items-center justify-between">
            <Label htmlFor={module}>{MODULE_LABELS[module]}</Label>
            <Switch id={module} checked={permissions[module]} disabled aria-readonly="true" />
          </div>
        ))}
      </div>

      <Alert data-testid="permissions-read-only-note">
        <Info className="h-4 w-4" />
        <AlertTitle>Per-user permission overrides are not stored yet</AlertTitle>
        <AlertDescription>
          <p>
            This matrix shows what the role <strong>{user.role}</strong> reaches by default; the server decides from
            the user&apos;s roles and scope grants. Roles are managed in User Management.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/users">Open User Management</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
