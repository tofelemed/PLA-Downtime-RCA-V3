import type { EventRevisionView } from '@/api/v2/types/events';
import { Badge } from '@/components/ui/badge';
import { useUserNames } from '@/features/ux-kit/labels';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { factLabel, factText } from '../model/fact-display';
import { lastUserChangeOf, latestFacts, latestRevisionNumber } from '../model/source-facts';
import { useFactResolvers } from '../hooks/use-fact-resolvers';

export interface SourceEffectiveTableProps {
  revisions: readonly EventRevisionView[];
  /** fields the user overrode (from the event view) */
  overriddenFields: readonly string[];
  /**
   * O1: the event's current state and coding from the event row (`currentStateFacts`). "In use" shows these,
   * so it always matches the status chips; the revision facts stay history in the History tab.
   */
  current?: Readonly<Record<string, unknown>>;
}

interface FactRow {
  field: string;
  effective: string;
  source: string;
  differs: boolean;
  overridden: boolean;
  /** user id of the last manual change of an overridden field (null: not in the revision log) */
  changedBy: string | null;
}

/** Facts that are bookkeeping, not event values: kept out of the comparison. */
const HIDDEN_FIELDS: ReadonlySet<string> = new Set(['id', 'tenantId', 'tenantUuid', 'rowVersion', 'canonicalId', 'occurrenceId', 'eventId']);

/** ING06 source vs effective comparison: labelled fields, readable values, overrides and differences marked. */
export function SourceEffectiveTable({ revisions, overriddenFields, current = {} }: SourceEffectiveTableProps) {
  const resolvers = useFactResolvers();
  const users = useUserNames(revisions.map((revision) => revision.actorId));
  const latest = latestFacts(revisions);
  const effective = { ...latest.effective, ...current };
  const source = latest.source;
  const latestRevision = latestRevisionNumber(revisions);
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
        changedBy: overriddenFields.includes(field) ? lastUserChangeOf(revisions, field)?.actorId ?? null : null,
      };
    })
    .sort((a, b) => factLabel(a.field).localeCompare(factLabel(b.field)));
  const columns: DataTableColumn<FactRow>[] = [
    {
      id: 'field',
      header: 'Field',
      cell: (row) => (
        <span className={row.differs ? 'font-medium text-warning' : undefined}>
          {factLabel(row.field)}
          {row.overridden && (
            <Badge variant="outline" className="ml-2" data-testid="override-badge">
              {row.changedBy ? `Changed by ${users.nameOf(row.changedBy)}` : 'Changed in Traverse Forge'}
            </Badge>
          )}
          {row.differs && <span className="sr-only"> (differs from the source)</span>}
        </span>
      ),
    },
    { id: 'effective', header: 'In use', cell: (row) => row.effective },
    { id: 'source', header: 'From the source', cell: (row) => row.source },
  ];
  return (
    <div data-testid="source-effective" className="space-y-2">
      {latestRevision !== null && (
        <p className="text-xs text-muted-foreground" data-testid="source-effective-note">
          "In use" is the event as it is now. The History tab lists the values recorded at each revision (latest: revision {latestRevision}).
        </p>
      )}
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
