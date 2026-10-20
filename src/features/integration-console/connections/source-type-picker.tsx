import type { SourceType } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { SOURCE_TYPE_OPTIONS } from '../model/source-types';

const AVAILABILITY_LABEL = { available: 'Available', scheduled: 'Not available yet', planned: 'Planned' } as const;

/**
 * Source type choice of the wizard: PI Web API and MQTT are selectable; types without an adapter (Kafka,
 * OPC UA) are shown disabled with the reason, never as controls that would do nothing.
 */
export function SourceTypePicker({ onPick }: { onPick: (type: SourceType) => void }) {
  return (
    <div role="radiogroup" aria-label="Source type" className="grid gap-2 sm:grid-cols-2">
      {SOURCE_TYPE_OPTIONS.map((option) => {
        const enabled = option.availability === 'available';
        return (
          <button
            key={option.type}
            type="button"
            role="radio"
            aria-checked={false}
            aria-disabled={!enabled}
            disabled={!enabled}
            data-testid={`source-type-${option.type}`}
            data-availability={option.availability}
            onClick={() => enabled && onPick(option.type)}
            className="rounded-md border p-3 text-left text-sm enabled:hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex items-center justify-between gap-2 font-medium">
              {option.label}
              <Badge variant={enabled ? 'default' : 'outline'}>{AVAILABILITY_LABEL[option.availability]}</Badge>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
