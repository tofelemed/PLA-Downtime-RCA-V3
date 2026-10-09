import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EventRevisionView } from '@/api/v2/types/events';
import { latestFacts } from '../model/source-facts';

export interface SourceEffectiveTableProps {
  revisions: readonly EventRevisionView[];
  /** fields the user overrode (from the event view) */
  overriddenFields: readonly string[];
}

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

/** ING06 source vs effective comparison: overridden fields are marked, differences highlighted. */
export function SourceEffectiveTable({ revisions, overriddenFields }: SourceEffectiveTableProps) {
  const { effective, source } = latestFacts(revisions);
  const fields = [...new Set([...Object.keys(effective), ...Object.keys(source ?? {})])].sort();
  if (fields.length === 0) return <p className="text-sm text-muted-foreground">No revisions recorded.</p>;
  return (
    <Table data-testid="source-effective">
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Effective</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => {
          const differs = source !== null && field in source && show(source[field]) !== show(effective[field]);
          return (
            <TableRow key={field} className={differs ? 'bg-amber-50 dark:bg-amber-950/30' : undefined}>
              <TableCell className="font-mono text-xs">
                {field}
                {overriddenFields.includes(field) && (
                  <Badge variant="outline" className="ml-2">
                    overridden
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">{show(effective[field])}</TableCell>
              <TableCell className="text-xs">{source ? show(source[field]) : 'manual event'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
