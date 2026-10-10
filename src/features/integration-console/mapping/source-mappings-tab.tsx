import { useConnections } from '@/api/v2/queries/integration-connections';
import { useSourceMappings } from '@/api/v2/queries/integration-mappings';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';

/**
 * Source → plant rules of the tenant (ING03), in resolution order of their kind: exact id, exact path,
 * pattern, AF binding. Rules mirrored from the v1 hierarchy mapping are edited in v1 until 3.10.
 */
export function SourceMappingsTab() {
  const mappings = useSourceMappings();
  const units = flattenPages(useUnits().data?.pages);
  const connections = useConnections(true);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id.slice(0, 8);
  const connectionName = (id: string | null) => (id ? connections.items.find((connection) => connection.id === id)?.displayName ?? id.slice(0, 8) : 'every connection');
  return (
    <DataState state={dataStateOf(mappings, { isEmpty: mappings.items.length === 0 })} error={mappings.error} detail={mappings.items.length === 0 ? 'No source mapping rule yet.' : undefined}>
      <div className="overflow-x-auto" data-testid="source-mappings">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Source value</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Precedence</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.items.map((rule) => (
              <TableRow key={rule.id} data-testid="source-mapping" data-match={rule.matchValue}>
                <TableCell>{rule.matchKind}</TableCell>
                <TableCell className="max-w-72 break-all">{rule.matchValue}</TableCell>
                <TableCell>
                  {rule.targetType} {rule.targetType === 'unit' ? unitName(rule.targetId) : rule.targetId.slice(0, 8)}
                </TableCell>
                <TableCell>{connectionName(rule.connectionId)}</TableCell>
                <TableCell>{rule.precedence}</TableCell>
                <TableCell>
                  v{rule.version} {!rule.isActive && <Badge variant="outline">inactive</Badge>} {rule.legacyMappingId && <Badge variant="outline">v1</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataState>
  );
}
