import { useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConsoleRefusal } from '../components/console-refusal';
import { endpointSummary } from '../model/endpoint-summary';
import { isSourceSupported, sourceTypeLabel } from '../model/source-types';

/** Name, type, endpoint (never a credential), config version and the edit / (de)activate commands. */
export function ConnectionHeader({ connection, onEdit }: { connection: ConnectionView; onEdit: () => void }) {
  const { canWriteIntegration } = useCapabilities();
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
      <p className="break-all text-xs text-muted-foreground" data-testid="connection-endpoint">
        {endpointSummary(connection)}
      </p>
      {isSourceSupported(connection.sourceType) && canWriteIntegration && (
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
