import { useState } from 'react';
import { useSignals } from '@/api/v2/queries/signals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { SignalActions } from './signal-actions';

/** Typed signals of a connection (plan 1.7): definition, unit of measure, version; preview and backfill. */
export function SignalsPanel({ connectionId }: { connectionId: string }) {
  const signals = useSignals(connectionId);
  const [selected, setSelected] = useState<string | null>(null);
  const current = signals.items.filter((signal) => signal.effectiveTo === null);
  const chosen = current.find((signal) => signal.id === selected) ?? null;
  return (
    <section aria-label="Signals" className="space-y-3" data-testid="signals-panel">
      <DataState
        state={dataStateOf(signals, { isEmpty: current.length === 0 })}
        error={signals.error}
        detail={current.length === 0 ? 'No signal is defined for this connection (signals are defined through the signals API, plan 1.7).' : undefined}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit of measure</TableHead>
                <TableHead>Source key</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.map((signal) => (
                <TableRow key={signal.id} aria-selected={signal.id === selected} onClick={() => setSelected(signal.id)} className="cursor-pointer">
                  <TableCell>
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSelected(signal.id)}>
                      {signal.name}
                    </button>
                  </TableCell>
                  <TableCell>{signal.semanticType}</TableCell>
                  <TableCell>{signal.canonicalUom ?? '—'}{signal.rateTimebase ? ` / ${signal.rateTimebase}` : ''}</TableCell>
                  <TableCell className="max-w-48 truncate">{signal.sourceKey}</TableCell>
                  <TableCell>v{signal.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataState>
      {chosen && <SignalActions key={chosen.id} signal={chosen} />}
    </section>
  );
}
