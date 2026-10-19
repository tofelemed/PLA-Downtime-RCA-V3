import type { RuleSimulationView, RulesSchemaView } from '@/api/v2/types/rules';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels/humanize';
import { usePlantDates } from '../hooks/use-plant-dates';
import { useRuleValueText } from '../hooks/use-rule-value-text';
import type { ValueText } from '../model/rule-describe';
import { type NumberFormat, useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural, pluralNoun } from '@/features/ux-kit/format/plural';

type Distribution = RuleSimulationView['fields'][string];
type Sample = RuleSimulationView['samples'][number];

interface FieldRow {
  field: string;
  distribution: Distribution;
}

const countsText = (field: string, record: Record<string, number>, valueText: ValueText, number: NumberFormat['number']) =>
  Object.entries(record)
    .map(([value, count]) => `${value === 'null' ? 'Not set' : valueText(field, value)}: ${number(count)}`)
    .join(', ') || '—';

function fieldLabel(schema: RulesSchemaView, field: string): string {
  return schema.kinds.flatMap((kind) => kind.sets).find((entry) => entry.field === field)?.label ?? schema.fields.find((entry) => entry.name === field)?.label ?? humanize(field);
}

/** A recorded simulation run as the server returned it (counts and diffs are never computed here). */
export function SimulationResult({ result, schema }: { result: RuleSimulationView; schema: RulesSchemaView }) {
  const { number } = useNumberFormat();
  const dates = usePlantDates();
  const valueText = useRuleValueText(schema);
  const fieldRows: FieldRow[] = Object.entries(result.fields).map(([field, distribution]) => ({ field, distribution }));
  const fieldColumns: Array<DataTableColumn<FieldRow>> = [
    { id: 'field', header: 'Field', cell: (row) => <span data-testid="sim-field" data-field={row.field}>{fieldLabel(schema, row.field)}</span> },
    { id: 'before', header: 'Before', cell: (row) => countsText(row.field, row.distribution.before, valueText, number) },
    { id: 'after', header: 'After', cell: (row) => countsText(row.field, row.distribution.after, valueText, number) },
  ];
  const sampleColumns: Array<DataTableColumn<Sample>> = [
    { id: 'start', header: 'Event start', nowrap: true, cell: (sample) => <span data-testid="sim-sample">{dates.dateTime(sample.startTime)}</span> },
    {
      id: 'changes',
      header: 'Would change',
      cell: (sample) =>
        sample.changes.map((change) => `${fieldLabel(schema, change.field)}: ${change.before === null ? 'Not set' : valueText(change.field, change.before)} → ${valueText(change.field, change.after)}`).join('; ') || 'No change',
    },
    { id: 'flags', header: 'Flags', cell: (sample) => sample.flags.join(', ') || '—' },
  ];
  return (
    <div className="space-y-4 text-sm" data-testid="sim-result" data-evaluated={result.evaluated} data-matched={result.matched} data-changed={result.changed} data-version={result.version ?? 'draft'}>
      <p>
        {result.version === null ? 'Draft' : `Version ${result.version}`} over {dates.validity(result.scope.from, result.scope.to)}: <strong>{number(result.evaluated)}</strong> {pluralNoun(result.evaluated, 'event', 'events')} evaluated,{' '}
        <strong>{number(result.matched)}</strong> matched, <strong>{number(result.changed)}</strong> would change.
        {result.truncated && ' Only the latest events were evaluated (sample limit).'}
        {result.budgetExceeded > 0 && ` ${plural(result.budgetExceeded, 'evaluation was', 'evaluations were', number)} too complex to finish and did not match.`}
      </p>
      {fieldRows.length > 0 && <DataTable caption="Field values before and after" columns={fieldColumns} rows={fieldRows} getRowKey={(row) => row.field} pager="none" density="compact" />}
      {Object.keys(result.flags).length > 0 && <p data-testid="sim-flags">Flags: {Object.entries(result.flags).map(([flag, count]) => `${flag}: ${number(count)}`).join(', ')}</p>}
      {result.samples.length > 0 && <DataTable caption="Sample events" columns={sampleColumns} rows={result.samples} getRowKey={(sample) => sample.eventId} density="compact" />}
      <p className="text-xs text-muted-foreground">
        The simulation was recorded. It shows the rule on its own: on new events, user choices and reason-code defaults still come first.
      </p>
    </div>
  );
}
