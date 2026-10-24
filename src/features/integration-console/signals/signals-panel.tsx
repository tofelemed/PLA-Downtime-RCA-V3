import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignalsPage } from '@/api/v2/queries/signals';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, SIGNAL_TYPE_LABELS, useUnitNames } from '@/features/ux-kit/labels';
import { IntegrationCard } from '../components/integration-card';
import { signalUomText } from '../model/signal-uom';
import { ActionIcon } from '@/lib/icons';
import { historianPath, newSignalPath } from '../paths';
import { SignalActions } from './signal-actions';

const SIGNALS_INFO = "The measurements this connection delivers (rates, counters, states), every version. A name opens its trend in the historian; a row's preview shows the server's quantity for a period.";

function DefineSignal({ connectionId }: { connectionId: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link to={newSignalPath(connectionId)} data-testid="new-signal">
        <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> Define signal
      </Link>
    </Button>
  );
}

interface ColumnContext {
  unitName: (id: string) => string;
  selectedId: string | null;
  onSelect: (signal: SignalView) => void;
}

function columnsOf({ unitName, selectedId, onSelect }: ColumnContext, allowBackfill: boolean): DataTableColumn<SignalView>[] {
  return [
    {
      id: 'name',
      header: 'Signal',
      cell: (signal) => (
        <Link to={historianPath([signal.id])} className="font-medium underline-offset-2 hover:underline" data-testid="signal-trend-link">
          {signal.name}
        </Link>
      ),
    },
    { id: 'type', header: 'Type', nowrap: true, cell: (signal) => labelOf(SIGNAL_TYPE_LABELS, signal.semanticType) },
    { id: 'uom', header: 'Unit of measure', nowrap: true, cell: signalUomText },
    { id: 'unit', header: 'Production unit', cell: (signal) => <span>{unitName(signal.unitId)}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (signal) => `v${signal.version}${signal.effectiveTo === null ? ' (current)' : ''}` },
    {
      id: 'actions',
      header: allowBackfill ? 'Quantity and backfill' : 'Stored samples and quantity',
      cell: (signal) => (
        <Button size="sm" className="whitespace-nowrap" variant={signal.id === selectedId ? 'secondary' : 'outline'} aria-pressed={signal.id === selectedId} onClick={() => onSelect(signal)}>
          {allowBackfill ? 'Preview / backfill' : 'Preview samples / quantity'}
        </Button>
      ),
    },
  ];
}

/**
 * Typed signals of a connection (plan 1.7), every version, 20 per page: a name opens its trend in the
 * historian; a row's preview shows the server's quantity for a period and writers can backfill it.
 */
export function SignalsPanel({ connectionId, timezone, allowBackfill = true }: { connectionId: string; timezone: string; allowBackfill?: boolean }) {
  const { canWriteIntegration } = useCapabilities();
  const signals = useSignalsPage(connectionId);
  const units = useUnitNames();
  const [selected, setSelected] = useState<SignalView | null>(null);
  const columns = useMemo(() => columnsOf({ unitName: units.nameOf, selectedId: selected?.id ?? null, onSelect: setSelected }, allowBackfill), [units, selected, allowBackfill]);
  return (
    <div className="space-y-4">
      <IntegrationCard title="Signals" info={SIGNALS_INFO} actions={canWriteIntegration ? <DefineSignal connectionId={connectionId} /> : undefined} testId="signals-panel">
        <DataTable
          caption="Signals"
          columns={columns}
          rows={signals.rows}
          getRowKey={(signal) => signal.id}
          pager={signals.pager}
          status={signals.status}
          empty={{ title: 'No signals yet', text: 'No signals defined yet.' }}
        />
      </IntegrationCard>
      {selected && <SignalActions key={selected.id} signal={selected} timezone={timezone} allowBackfill={allowBackfill} />}
    </div>
  );
}
