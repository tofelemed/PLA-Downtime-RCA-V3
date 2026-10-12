import type { EventRevisionView } from '@/api/v2/types/events';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { factLabel, factText } from '../model/fact-display';
import { latestFacts } from '../model/source-facts';
import { useFactResolvers } from '../hooks/use-fact-resolvers';

export interface SourceEffectiveTableProps {
  revisions: readonly EventRevisionView[];
  /** fields the user overrode (from the event view) */
  overriddenFields: readonly string[];
}

interface FactRow {
  field: string;
  effective: string;
  source: string;
  differs: boolean;
  overridden: boolean;
}

/** Facts that are bookkeeping, not event values: kept out of the comparison. */
const HIDDEN_FIELDS: ReadonlySet<string> = new Set(['id', 'tenantId', 'tenantUuid', 'rowVersion', 'canonicalId', 'occurrenceId', 'eventId']);

/** ING06 source vs effective comparison: labelled fields, readable values, overrides and differences marked. */
export function SourceEffectiveTable({ revisions, overriddenFields }: SourceEffectiveTableProps) {
  const resolvers = useFactResolvers();
  const { effective, source } = latestFacts(revisions);
  const fields = [...new Set([...Object.keys(effective), ...Object.keys(source ?? {})])].filter((field) => !HIDDEN_FIELDS.has(field));
  const rows: FactRow[] = fields
    .map((field) => {
      const effectiveText = factText(field, effective[field], resolvers);
      const sourceText = source ? factText(field, source[field], resolvers) : 'Entered manually';
      return {
        field,
        effective: effectiveText,
        source: sourceText,
        differs: source !== null && field in source && sourceText !== effectiveText,
        overridden: overriddenFields.includes(field),
      };
    })
    .sort((a, b) => factLabel(a.field).localeCompare(factLabel(b.field)));
  const columns: DataTableColumn<FactRow>[] = [
    {
      id: 'field',
      header: 'Field',
      cell: (row) => (
        <span className={row.differs ? 'font-medium text-amber-800 dark:text-amber-200' : undefined}>
          {factLabel(row.field)}
          {row.overridden && <Badge variant="outline" className="ml-2">Changed by a user</Badge>}
          {row.differs && <span className="sr-only"> (differs from the source)</span>}
        </span>
      ),
    },
    { id: 'effective', header: 'In use', cell: (row) => row.effective },
    { id: 'source', header: 'From the source', cell: (row) => row.source },
  ];
  return (
    <div data-testid="source-effective">
      <DataTable
        caption="Values in use and values from the source"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.field}
        density="compact"
        empty={{ title: 'No revisions recorded' }}
      />
    </div>
  );
}
