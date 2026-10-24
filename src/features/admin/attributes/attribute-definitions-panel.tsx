import { Link, useNavigate } from 'react-router-dom';
import { useAttributeDefinitionsPage } from '@/api/v2/queries/administration-config';
import { ATTRIBUTE_ENTITY_TYPES, type AttributeDefinitionView, type AttributeEntityType } from '@/api/v2/types/administration';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { ATTRIBUTE_DATA_TYPE_LABELS, ATTRIBUTE_ENTITY_LABELS, ATTRIBUTE_SCOPE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { Label } from '@/components/ui/label';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { ActionIcon, UiIcon } from '@/lib/icons';
import { AdminCard } from '../shared/admin-card';
import { FilterSelect } from '../shared/filter-select';
import { useUrlFilters } from '../shared/use-url-filters';

const LEVEL_OPTIONS = ATTRIBUTE_ENTITY_TYPES.map((value) => ({ value, label: ATTRIBUTE_ENTITY_LABELS[value] }));
const DEFAULTS = { level: 'Unit' } as const;

const COLUMNS: ReadonlyArray<DataTableColumn<AttributeDefinitionView>> = [
  { id: 'name', header: 'Attribute', cell: (definition) => definition.displayName },
  { id: 'type', header: 'Type', cell: (definition) => labelOf(ATTRIBUTE_DATA_TYPE_LABELS, definition.dataType), nowrap: true },
  { id: 'required', header: 'Required', cell: (definition) => (definition.isRequired ? 'Required' : 'Optional'), nowrap: true },
  { id: 'scope', header: 'Applies to', cell: (definition) => labelOf(ATTRIBUTE_SCOPE_LABELS, definition.scope), nowrap: true },
  {
    id: 'state',
    header: 'State',
    cell: (definition) => <Badge variant={definition.isActive ? 'secondary' : 'outline'} className="whitespace-nowrap">{definition.isActive ? 'In use' : 'Hidden'}</Badge>,
    nowrap: true,
  },
  { id: 'open', header: <span className="sr-only">Open</span>, headerLabel: 'Open', cell: () => <UiIcon.next aria-hidden="true" className="h-4 w-4 text-muted-foreground" />, width: '2.5rem' },
];

/**
 * Custom attribute definitions of one hierarchy level, in display order (Admin panel → Custom attributes).
 * Master data links here (`/admin?tab=attributes&level=Unit`) to manage the fields of a level.
 */
export function AttributeDefinitionsPanel() {
  const navigate = useNavigate();
  const { canManageMasterData } = useCapabilities();
  const [values, setValues] = useUrlFilters(DEFAULTS);
  const level = values.level as AttributeEntityType;
  const definitions = useAttributeDefinitionsPage(level);
  return (
    <AdminCard
      title="Custom attributes"
      info="Extra fields of organizations, plants, units and assets, filled in Master data."
      testId="custom-attributes"
      actions={
        canManageMasterData && (
          <Button asChild variant="outline" className="h-9">
            <Link to={`/admin/attributes/new?level=${encodeURIComponent(level)}`}>
              <ActionIcon.add aria-hidden="true" />
              Add attribute
            </Link>
          </Button>
        )
      }
    >
      <div className={FIELD_CLASS}>
        <Label htmlFor="attributes-level">Level</Label>
        <FilterSelect id="attributes-level" label="Hierarchy level" className="h-9" value={level} options={LEVEL_OPTIONS} onChange={(next) => setValues({ level: next })} />
      </div>
      <DataTable
        caption={`Custom attributes of ${labelOf(ATTRIBUTE_ENTITY_LABELS, level).toLowerCase()}`}
        columns={COLUMNS}
        rows={definitions.rows}
        getRowKey={(definition) => definition.id}
        pager={definitions.pager}
        status={definitions.status}
        density="compact"
        empty={{ title: 'No custom attributes', text: 'This level has no extra fields yet.' }}
        onRowClick={(definition) => navigate(`/admin/attributes/${definition.id}`)}
        rowLabel={(definition) => `Open attribute ${definition.displayName}`}
      />
    </AdminCard>
  );
}
