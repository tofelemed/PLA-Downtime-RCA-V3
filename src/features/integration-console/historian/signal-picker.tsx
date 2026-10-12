import { useState } from 'react';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { MAX_TREND_SIGNALS } from './historian-model';

export interface SignalPickerProps {
  catalog: readonly SignalView[];
  chosenIds: readonly string[];
  isLoading: boolean;
  onChange: (ids: readonly string[]) => void;
}

/** Chooses up to five current signals of the plant for one trend; each chosen signal can be removed. */
export function SignalPicker({ catalog, chosenIds, isLoading, onChange }: SignalPickerProps) {
  const [candidate, setCandidate] = useState('');
  const current = catalog.filter((signal) => signal.effectiveTo === null);
  const options = current.filter((signal) => !chosenIds.includes(signal.id)).map((signal) => ({ value: signal.id, label: signal.name }));
  const nameOf = (id: string) => catalog.find((signal) => signal.id === id)?.name ?? 'Unknown signal';
  const full = chosenIds.length >= MAX_TREND_SIGNALS;
  const add = () => {
    if (!candidate) return;
    onChange([...chosenIds, candidate]);
    setCandidate('');
  };
  return (
    <div className="space-y-2" data-testid="signal-picker">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64">
          <Field id="trend-signal" label="Signal" hint={full ? `At most ${MAX_TREND_SIGNALS} signals per trend.` : undefined}>
            <NativeSelect id="trend-signal" testId="trend-signal" value={candidate} disabled={full} placeholder={isLoading ? 'Loading…' : 'Choose a signal'} options={options} onChange={setCandidate} />
          </Field>
        </div>
        <Button size="sm" variant="outline" onClick={add} disabled={!candidate || full} data-testid="trend-add">
          <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> Add to trend
        </Button>
      </div>
      {chosenIds.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Signals in the trend">
          {chosenIds.map((id) => (
            <li key={id}>
              <Badge variant="secondary" className="gap-1 pr-0">
                {nameOf(id)}
                <IconButton label={`Remove ${nameOf(id)}`} icon={ActionIcon.remove} className="h-5 w-5" onClick={() => onChange(chosenIds.filter((other) => other !== id))} />
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
