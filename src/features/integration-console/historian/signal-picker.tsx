import { useState } from 'react';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { ActionIcon } from '@/lib/icons';
import { FilterField } from '../components/filter-field';
import { NativeSelect } from '../components/native-select';
import { MAX_TREND_SIGNALS } from './historian-model';

export interface SignalPickerProps {
  catalog: readonly SignalView[];
  chosenIds: readonly string[];
  isLoading: boolean;
  onChange: (ids: readonly string[]) => void;
}

const FULL_REASON = `At most ${MAX_TREND_SIGNALS} signals per trend.`;

/**
 * Chooses up to five current signals of the plant for one trend: a labelled h-9 select and its Add button,
 * laid out as items of the page's filter row (the chosen signals are listed by `ChosenSignals`).
 */
export function SignalPicker({ catalog, chosenIds, isLoading, onChange }: SignalPickerProps) {
  const [candidate, setCandidate] = useState('');
  const options = catalog.filter((signal) => signal.effectiveTo === null && !chosenIds.includes(signal.id)).map((signal) => ({ value: signal.id, label: signal.name }));
  const full = chosenIds.length >= MAX_TREND_SIGNALS;
  const add = () => {
    if (!candidate) return;
    onChange([...chosenIds, candidate]);
    setCandidate('');
  };
  return (
    <div className="contents" data-testid="signal-picker">
      <FilterField id="trend-signal" label="Signal" className="w-full sm:w-64">
        <NativeSelect id="trend-signal" testId="trend-signal" value={candidate} disabled={full} placeholder={isLoading ? 'Loading…' : 'Choose a signal'} options={options} onChange={setCandidate} />
      </FilterField>
      <Button size="sm" variant="outline" className="h-9 whitespace-nowrap" onClick={add} disabled={!candidate || full} aria-describedby={full ? 'trend-full' : undefined} data-testid="trend-add">
        <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> Add to trend
      </Button>
      <DisabledReason id="trend-full" reason={full ? FULL_REASON : null} />
    </div>
  );
}
