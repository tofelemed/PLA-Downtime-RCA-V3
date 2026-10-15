import { Link } from 'react-router-dom';
import type { BadActorItemView, BadActorReportView } from '@/api/v2/types/bad-actors';
import { Badge } from '@/components/ui/badge';
import { currencyDigits } from '@/features/display-currency/money-format';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { failureModeText, TRIGGER_LABELS } from './bad-actor-model';

const TRIGGER_VARIANT: Readonly<Record<string, 'default' | 'secondary' | 'outline' | 'destructive'>> = {
  fired: 'destructive',
  over_threshold: 'default',
  below: 'secondary',
  off: 'outline',
};

function ValueCell({ item }: { item: BadActorItemView }) {
  const value = item.value;
  if (!value) return <span className="text-muted-foreground">No approved value</span>;
  return (
    <span data-testid="bad-actor-value" data-status={value.status}>
      {value.amount === null ? (
        <span className="text-muted-foreground">Not valued</span>
      ) : (
        <Quantity value={value.amount} uom={value.currency} fractionDigits={currencyDigits(value.currency)} />
      )}
      {value.status === 'mixed' && <span className="ml-1 text-xs text-muted-foreground">(partly valued)</span>}
      {value.fxProvisional && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">(provisional exchange rate)</span>}
    </span>
  );
}

function TriggerCell({ item }: { item: BadActorItemView }) {
  const { trigger } = item;
  return (
    <span className="flex flex-col gap-0.5" data-testid="bad-actor-trigger" data-state={trigger.state}>
      <Badge variant={TRIGGER_VARIANT[trigger.state] ?? 'outline'} className="w-fit">
        {TRIGGER_LABELS[trigger.state]}
      </Badge>
      {trigger.thresholdSeconds !== null && (
        <span className="text-xs text-muted-foreground">
          <DurationText seconds={trigger.seconds} variant="compact" /> of <DurationText seconds={trigger.thresholdSeconds} variant="compact" /> same-mode downtime
          {trigger.criticalAsset ? ' (critical asset: limit halved)' : ''}
        </span>
      )}
      {trigger.rcaId && (
        <Link className="text-xs underline" to={`/rca/${trigger.rcaId}`}>
          Open the case
        </Link>
      )}
    </span>
  );
}

function columnsOf(report: BadActorReportView, number: (value: number) => string): Array<DataTableColumn<BadActorItemView>> {
  const columns: Array<DataTableColumn<BadActorItemView>> = [
    { id: 'rank', header: '#', align: 'right', cell: (item) => number(item.rank) },
    {
      id: 'asset',
      header: 'Asset',
      cell: (item) => (
        <span data-testid="bad-actor-asset" data-key={item.key}>
          {[item.assetCode, item.assetName].filter(Boolean).join(' ') || 'Unknown asset'}
        </span>
      ),
    },
  ];
  if (report.groupBy === 'failure_mode') columns.push({ id: 'mode', header: 'Failure mode', cell: (item) => failureModeText(item.failureMode) });
  return [
    ...columns,
    { id: 'quantity', header: 'Approved lost quantity', align: 'right', nowrap: true, cell: (item) => (item.quantity === null ? '—' : <Quantity value={item.quantity} uom={report.uom} />) },
    { id: 'value', header: `Approved value (${report.currency})`, align: 'right', cell: (item) => <ValueCell item={item} /> },
    { id: 'stops', header: 'Stops', align: 'right', cell: (item) => number(item.stops) },
    { id: 'downtime', header: 'Unplanned downtime', align: 'right', nowrap: true, cell: (item) => <DurationText seconds={item.downtimeSeconds} variant="compact" /> },
    { id: 'trigger', header: 'Bad-actor trigger', cell: (item) => <TriggerCell item={item} /> },
  ];
}

/** The server's ranked items as they come (rank order is the server's); nothing is summed or re-sorted. */
export function BadActorTable({ report }: { report: BadActorReportView }) {
  const { number } = useNumberFormat();
  return (
    <DataTable
      caption="Bad actors"
      columns={columnsOf(report, number)}
      rows={report.items}
      getRowKey={(item) => item.key}
      empty={{ text: 'No approved loss or stops in this window.' }}
      density="compact"
    />
  );
}
