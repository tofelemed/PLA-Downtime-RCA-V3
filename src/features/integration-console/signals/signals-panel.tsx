import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignalsPage } from '@/api/v2/queries/signals';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, SIGNAL_TIMEBASE_LABELS, SIGNAL_TYPE_LABELS, useUnitNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { historianPath, newSignalPath } from '../paths';
import { SignalActions } from './signal-actions';

interface ColumnContext {
  unitName: (id: string) => string;
  selectedId: string | null;
  onSelect: (signal: SignalView) => void;
}

const uomOf = (signal: SignalView) => `${signal.canonicalUom ?? '—'}${signal.rateTimebase ? ` ${labelOf(SIGNAL_TIMEBASE_LABELS, signal.rateTimebase)}` : ''}`;

function columnsOf({ unitName, selectedId, onSelect }: ColumnContext): DataTableColumn<SignalView>[] {
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
    { id: 'uom', header: 'Unit of measure', nowrap: true, cell: uomOf },
    { id: 'unit', header: 'Production unit', cell: (signal) => <span>{unitName(signal.unitId)}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (signal) => `v${signal.version}${signal.effectiveTo === null ? ' (current)' : ''}` },
    {
      id: 'actions',
      header: 'Quantity and backfill',
      cell: (signal) => (
        <Button size="sm" variant={signal.id === selectedId ? 'secondary' : 'outline'} aria-pressed={signal.id === selectedId} onClick={() => onSelect(signal)}>
          Preview / backfill
        </Button>
      ),
    },
  ];
}

/**
 * Typed signals of a connection (plan 1.7), every version, 20 per page: a name opens its trend in the
 * historian; a row's preview shows the server's quantity for a period and writers can backfill it.
 */
export function SignalsPanel({ connectionId, timezone }: { connectionId: string; timezone: string }) {
  const { canWriteIntegration } = useCapabilities();
  const signals = useSignalsPage(connectionId);
  const units = useUnitNames();
  const [selected, setSelected] = useState<SignalView | null>(null);
  const columns = useMemo(() => columnsOf({ unitName: units.nameOf, selectedId: selected?.id ?? null, onSelect: setSelected }), [units, selected]);
  return (
    <section aria-label="Signals" className="space-y-3" data-testid="signals-panel">
      {canWriteIntegration && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <Link to={newSignalPath(connectionId)} data-testid="new-signal">
              <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> Define signal
            </Link>
          </Button>
        </div>
      )}
      <DataTable
        caption="Signals"
        columns={columns}
        rows={signals.rows}
        getRowKey={(signal) => signal.id}
        pager={signals.pager}
        status={signals.status}
        empty={{ title: 'No signals yet', text: 'Define the measurements this connection delivers (rates, counters, states) to trend and account them.' }}
      />
      {selected && <SignalActions key={selected.id} signal={selected} timezone={timezone} />}
    </section>
  );
}
