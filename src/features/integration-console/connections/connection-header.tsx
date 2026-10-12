import { Link } from 'react-router-dom';
import { useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { ConsoleRefusal } from '../components/console-refusal';
import { endpointSummary } from '../model/endpoint-summary';
import { isSourceSupported, sourceTypeLabel } from '../model/source-types';
import { consolePath, editConnectionPath } from '../paths';

function ConnectionCommands({ connection }: { connection: ConnectionView }) {
  const update = useUpdateConnection();
  const toggle = () => update.submit({ connection, body: { isActive: !connection.isActive } });
  const activate = (
    <Button size="sm" variant="outline" onClick={() => void toggle().catch(() => null)} disabled={update.isPending} data-testid="connection-toggle">
      Activate
    </Button>
  );
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link to={editConnectionPath(connection.id)} data-testid="connection-edit">
          <ActionIcon.edit className="mr-1 h-4 w-4" aria-hidden="true" /> Edit
        </Link>
      </Button>
      {connection.isActive ? (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" disabled={update.isPending} data-testid="connection-toggle">
              Deactivate
            </Button>
          }
          title={`Deactivate ${connection.displayName}?`}
          description="Its jobs stop reading from the source until the connection is activated again."
          confirmLabel="Deactivate"
          destructive
          onConfirm={toggle}
        />
      ) : (
        activate
      )}
      <ConsoleRefusal error={update.error} />
    </>
  );
}

/** Page header of a connection: name, type, endpoint (never a credential), settings version, edit and (de)activate. */
export function ConnectionHeader({ connection }: { connection: ConnectionView }) {
  const { canWriteIntegration } = useCapabilities();
  const writable = isSourceSupported(connection.sourceType) && canWriteIntegration;
  return (
    <PageHeader
      title={connection.displayName}
      back={{ to: consolePath(), label: 'Connections' }}
      description={
        <span className="break-all" data-testid="connection-endpoint">
          {endpointSummary(connection)}
        </span>
      }
      actions={writable ? <ConnectionCommands connection={connection} /> : undefined}
      meta={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{sourceTypeLabel(connection.sourceType)}</Badge>
          <Badge variant="outline" data-testid="connection-active">{connection.isActive ? 'Active' : 'Inactive'}</Badge>
          <Badge variant="outline">Settings version {connection.configVersion}</Badge>
          <Badge variant="outline" data-testid="connection-secret">{connection.hasSecret ? 'Credential stored (write-only)' : 'No credential'}</Badge>
        </span>
      }
    />
  );
}
