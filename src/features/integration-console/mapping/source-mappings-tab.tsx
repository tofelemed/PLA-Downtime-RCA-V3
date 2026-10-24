import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConnections } from '@/api/v2/queries/integration-connections';
import { useSourceMappingsPage } from '@/api/v2/queries/integration-mappings';
import type { SourceMappingView } from '@/api/v2/types/integration-mappings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, MAPPING_TARGET_LABELS, MATCH_KIND_LABELS, useAssetNames, useUnitNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { FilterField } from '../components/filter-field';
import { FilterToggle } from '../components/filter-toggle';
import { IntegrationCard } from '../components/integration-card';
import { NativeSelect } from '../components/native-select';
import { useUrlParam } from '../hooks/use-url-param';
import { mappingPath, NEW_MAPPING_PATH } from '../paths';

const INACTIVE = ['no', 'yes'] as const;
const KINDS = ['any', 'exact_id', 'exact_path', 'pattern', 'af_binding'] as const;
const KIND_OPTIONS = KINDS.filter((kind) => kind !== 'any').map((kind) => ({ value: kind, label: labelOf(MATCH_KIND_LABELS, kind) }));

const MAPPINGS_INFO = 'Rules that place source records on a unit or asset: exact id, exact path, pattern or AF binding, each with a precedence. Bind a source from the quarantine, or add a rule with New mapping.';

interface Names {
  targetName: (rule: SourceMappingView) => string;
  connectionName: (id: string | null) => string;
}

function columnsOf({ targetName, connectionName }: Names): DataTableColumn<SourceMappingView>[] {
  return [
    {
      id: 'value',
      header: 'Source value',
      cell: (rule) => (
        <Link to={mappingPath(rule.id)} data-testid="source-mapping" data-match={rule.matchValue} className="break-all font-medium underline-offset-2 hover:underline">
          {rule.matchValue}
        </Link>
      ),
    },
    { id: 'kind', header: 'Match', nowrap: true, cell: (rule) => labelOf(MATCH_KIND_LABELS, rule.matchKind) },
    { id: 'target', header: 'Maps to', cell: (rule) => <span>{`${labelOf(MAPPING_TARGET_LABELS, rule.targetType)} ${targetName(rule)}`}</span> },
    { id: 'connection', header: 'Connection', cell: (rule) => <span>{connectionName(rule.connectionId)}</span> },
    { id: 'precedence', header: 'Precedence', align: 'right', nowrap: true, cell: (rule) => rule.precedence },
    {
      id: 'version',
      header: 'Version',
      nowrap: true,
      cell: (rule) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {`v${rule.version}`}
          {!rule.isActive && <Badge variant="outline" className="whitespace-nowrap">Inactive</Badge>}
        </span>
      ),
    },
  ];
}

/**
 * Source → plant rules of the tenant (ING03), 20 per page: exact id, exact path, pattern or AF binding to
 * a unit or asset. A rule opens its editor; writers add rules with "New mapping".
 */
export function SourceMappingsTab() {
  const { canWriteIntegration } = useCapabilities();
  const [inactive, setInactive] = useUrlParam('inactive', INACTIVE, 'no');
  const [kind, setKind] = useUrlParam('kind', KINDS, 'any');
  const list = useSourceMappingsPage(inactive === 'yes', kind === 'any' ? undefined : kind);
  const units = useUnitNames();
  const assets = useAssetNames();
  const connections = useConnections(true);
  const columns = useMemo(() => {
    const targetName = (rule: SourceMappingView) => (rule.targetType === 'unit' ? units.nameOf(rule.targetId) : assets.nameOf(rule.targetId));
    const connectionName = (id: string | null) => (id ? connections.items.find((connection) => connection.id === id)?.displayName ?? 'Unknown connection' : 'Every connection');
    return columnsOf({ targetName, connectionName });
  }, [units, assets, connections.items]);
  const newMapping = canWriteIntegration ? (
    <Button asChild size="sm" variant="outline">
      <Link to={NEW_MAPPING_PATH} data-testid="new-mapping">
        <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> New mapping
      </Link>
    </Button>
  ) : undefined;
  return (
    <IntegrationCard title="Source mappings" info={MAPPINGS_INFO} actions={newMapping} testId="source-mappings">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField id="mappings-kind" label="Match">
          <NativeSelect id="mappings-kind" value={kind === 'any' ? '' : kind} placeholder="Any match" options={KIND_OPTIONS} onChange={(next) => setKind((next || 'any') as (typeof KINDS)[number])} />
        </FilterField>
        <FilterToggle id="mappings-inactive" label="Show inactive" checked={inactive === 'yes'} onChange={(on) => setInactive(on ? 'yes' : 'no')} />
      </div>
      <DataTable
        caption="Source mappings"
        columns={columns}
        rows={list.rows}
        getRowKey={(rule) => rule.id}
        pager={list.pager}
        status={list.status}
        empty={{ title: 'No mapping rules yet', text: 'No mapping rules match these filters.' }}
      />
    </IntegrationCard>
  );
}
