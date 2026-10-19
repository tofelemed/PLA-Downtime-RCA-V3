import { plural } from '@/features/ux-kit/format/plural';
import { Link } from 'react-router-dom';
import { useNewFailureMark } from '@/api/v2/queries/stop-events';
import type { StopIncidentView } from '@/api/v2/types/stop-events';
import { Button } from '@/components/ui/button';
import { usePlantFormat } from '../hooks/use-plant-format';
import { CommandError } from '../components/command-error';
import { ReasonAction } from './reason-action';
import { SOURCE_KIND_LABELS } from './stop-links-text';

interface IncidentSectionProps {
  incident: StopIncidentView | null;
  eventId: string;
  occurrenceId: string;
  canDecide: boolean;
}

function MarkAction({ incident, occurrenceId }: { incident: StopIncidentView; occurrenceId: string }) {
  const mark = useNewFailureMark();
  const marked = incident.newFailureOccurrenceIds.includes(occurrenceId);
  const first = incident.stops[0]?.occurrenceId === occurrenceId;
  if (marked) {
    return (
      <span>
        <Button size="sm" variant="outline" data-testid="incident-unmark" onClick={() => void mark.submit({ occurrenceId, reason: null })}>
          Remove the new-failure mark
        </Button>
        <CommandError error={mark.error} />
      </span>
    );
  }
  if (first) return null;
  return (
    <ReasonAction
      label="This stop is a new failure"
      title="Separate this stop from the incident?"
      description="Use it when the function was restored before this stop (a verified repair). The stop starts a new failure and is counted on its own in MTBF."
      confirmLabel="Mark as new failure"
      error={mark.error}
      testId="incident-mark"
      onConfirm={(reason) => mark.submit({ occurrenceId, reason })}
    />
  );
}

/**
 * SME D5: repeat stops of one asset and reason within the merge window, grouped as one unresolved
 * incident. Every stop keeps its own duration (the stopped time is the stops, not the envelope); MTBF
 * counts the incident once.
 */
export function IncidentSection({ incident, eventId, occurrenceId, canDecide }: IncidentSectionProps) {
  const format = usePlantFormat();
  if (!incident) {
    return <p className="text-sm text-muted-foreground">This stop is not part of a repeat-stop incident.</p>;
  }
  return (
    <div className="space-y-2" data-testid="stop-incident">
      <p className="text-sm">
        {plural(incident.stopCount, 'stop', 'stops', format.number)} of one unresolved incident (restarts within {format.duration(incident.windowSeconds)}): stopped{' '}
        {format.duration(incident.stoppedSeconds)}
        {incident.envelopeSeconds !== null && ` within ${format.duration(incident.envelopeSeconds)}`}. Counted once in MTBF; each stop keeps its own duration.
      </p>
      <ol className="space-y-1 text-sm">
        {incident.stops.map((stop) => (
          <li key={stop.id} data-testid="incident-stop">
            {stop.id === eventId ? <strong>{format.dateTime(stop.startTime)}</strong> : <Link className="underline" to={`/events/${stop.id}`}>{format.dateTime(stop.startTime)}</Link>}
            {' · '}
            {stop.durationSeconds === null ? 'still open' : format.duration(stop.durationSeconds)} · {SOURCE_KIND_LABELS[stop.sourceKind] ?? stop.sourceKind}
          </li>
        ))}
      </ol>
      {canDecide && <MarkAction incident={incident} occurrenceId={occurrenceId} />}
    </div>
  );
}
