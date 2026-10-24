import type { SignalView } from '@/api/v2/types/integration-mappings';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';

export interface ChosenSignalsProps {
  catalog: readonly SignalView[];
  chosenIds: readonly string[];
  onChange: (ids: readonly string[]) => void;
}

/** The signals of the trend, each removable. */
export function ChosenSignals({ catalog, chosenIds, onChange }: ChosenSignalsProps) {
  if (chosenIds.length === 0) return null;
  const nameOf = (id: string) => catalog.find((signal) => signal.id === id)?.name ?? 'Unknown signal';
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Signals in the trend">
      {chosenIds.map((id) => (
        <li key={id}>
          <Badge variant="secondary" className="gap-1 whitespace-nowrap pr-0">
            {nameOf(id)}
            <IconButton label={`Remove ${nameOf(id)}`} icon={ActionIcon.remove} className="h-5 w-5" onClick={() => onChange(chosenIds.filter((other) => other !== id))} />
          </Badge>
        </li>
      ))}
    </ul>
  );
}
