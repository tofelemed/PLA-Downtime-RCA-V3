import type { ProductionEventView } from '@/api/v2/types/events';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { labelOf } from '@/features/ux-kit/labels';
import { EVENT_FIELD_LABELS } from '@/features/ux-kit/labels/event-labels';

/**
 * E-5: an event delivered by a connected source (PI / MQTT): the rule stated once, with the fields that
 * already carry a user override. The single fields the source owns (`sourceOwnedFields`) are marked on
 * the form itself ("From <source>", read-only interval, "Override…").
 */
export function SourceOverrideBanner({ event }: { event: ProductionEventView }) {
  if (event.sourceKind === 'manual') return null;
  const source = event.source?.trim() || 'a connected source (PI/MQTT)';
  const kind = event.classification.physicalType === 'downtime' ? 'stop' : 'event';
  const overridden = (event.overriddenFields ?? []).map((field) => labelOf(EVENT_FIELD_LABELS, field));
  return (
    <Alert data-testid="source-override-banner">
      <AlertDescription>
        This {kind} comes from {source}; changes to source fields are recorded as overrides of the source value.
        {overridden.length > 0 && <span className="block text-xs" data-testid="overridden-fields">Already overridden: {overridden.join(', ')}.</span>}
      </AlertDescription>
    </Alert>
  );
}
