import { useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConsoleRefusal } from '../components/console-refusal';
import { isSourceSupported, sourceTypeLabel } from '../model/source-types';

const text = (value: unknown) => (typeof value === 'string' ? value : null);

/** Name, type, endpoint (never a credential), config version and the edit / (de)activate commands. */
export function ConnectionHeader({ connection, onEdit }: { connection: ConnectionView; onEdit: () => void }) {
  const update = useUpdateConnection();
  const toggle = () => void update.submit({ connection, body: { isActive: !connection.isActive } }).catch(() => null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{connection.displayName}</h2>
        <Badge variant="secondary">{sourceTypeLabel(connection.sourceType)}</Badge>
        <Badge variant="outline" data-testid="connection-active">{connection.isActive ? 'Active' : 'Inactive'}</Badge>
        <Badge variant="outline">config v{connection.configVersion}</Badge>
        <Badge variant="outline" data-testid="connection-secret">{connection.hasSecret ? 'Credential stored (write-only)' : 'No credential'}</Badge>
      </div>
      <p className="break-all text-xs text-muted-foreground">
        {text(connection.endpointConfig.piWebApiUrl) ?? 'no endpoint'}
        {text(connection.endpointConfig.username) ? ` · user ${text(connection.endpointConfig.username)}` : ''}
        {connection.endpointConfig.allowInsecureTls === true ? ' · TLS verification disabled' : ''}
      </p>
      {isSourceSupported(connection.sourceType) && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} data-testid="connection-edit">
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={toggle} disabled={update.isPending} data-testid="connection-toggle">
            {connection.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      )}
      <ConsoleRefusal error={update.error} />
    </div>
  );
}
