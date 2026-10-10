import { Plus } from 'lucide-react';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useConnections } from '@/api/v2/queries/integration-connections';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { sourceTypeLabel } from '../model/source-types';

export interface ConnectionsListProps {
  selectedId: string | null;
  includeInactive: boolean;
  onIncludeInactive: (value: boolean) => void;
  onSelect: (connection: ConnectionView) => void;
  onCreate: () => void;
}

/** `GET /connections` (secrets redacted): source type, state, config version, credential stored. */
export function ConnectionsList({ selectedId, includeInactive, onIncludeInactive, onSelect, onCreate }: ConnectionsListProps) {
  const connections = useConnections(includeInactive);
  const state = dataStateOf(connections, { isEmpty: connections.items.length === 0 });
  return (
    <section aria-label="Connections" className="space-y-3" data-testid="connections-list">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Connections</h2>
        <Button size="sm" onClick={onCreate} data-testid="new-connection">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="include-inactive" checked={includeInactive} onCheckedChange={(checked) => onIncludeInactive(checked === true)} />
        <Label htmlFor="include-inactive" className="text-sm">
          Show inactive
        </Label>
      </div>
      <DataState
        state={state}
        error={connections.error}
        onRetry={() => void connections.refetch()}
        detail={state === 'empty' ? 'No connection is configured. PI details are pending (D02): create one when the PI administrator provides the URL and credentials (a simulator works for testing).' : undefined}
      >
        <ul className="space-y-2">
          {connections.items.map((connection) => (
            <li key={connection.id}>
              <button
                type="button"
                data-testid="connection-item"
                data-connection-id={connection.id}
                aria-current={connection.id === selectedId}
                onClick={() => onSelect(connection)}
                className={`w-full rounded-md border p-3 text-left text-sm ${connection.id === selectedId ? 'border-primary bg-muted' : 'hover:bg-muted/50'}`}
              >
                <span className="block font-medium">{connection.displayName}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{sourceTypeLabel(connection.sourceType)}</Badge>
                  <Badge variant="outline">{connection.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant="outline">config v{connection.configVersion}</Badge>
                  {!connection.hasSecret && <Badge variant="outline">No credential</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}
