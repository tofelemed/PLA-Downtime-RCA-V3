/** One physical stop occurrence as the incident grouping sees it (its first event's asset and reason). */
export interface IncidentStop {
  occurrenceId: string;
  unitId: string;
  assetId: string | null;
  reasonCodeId: string | null;
  start: Date;
  /** null = still stopped */
  end: Date | null;
}

export interface IncidentOptions {
  /** SME D5 pilot: 120 s from one stop's end to the next stop's start */
  windowSeconds: number;
  /** occurrences a person marked as a new failure (function restored before it): never joined to the previous */
  breaks: ReadonlySet<string>;
}

/** Repeat stops grouped under one unresolved incident (two or more occurrences). */
export interface StopIncident {
  /** the first occurrence: the incident's stable identity */
  firstOccurrenceId: string;
  unitId: string;
  assetId: string | null;
  reasonCodeId: string;
  occurrenceIds: string[];
  start: Date;
  /** null while the last stop is open */
  end: Date | null;
}

const keyOf = (stop: IncidentStop) =>
  `${stop.unitId}|${stop.assetId ?? ''}|${stop.reasonCodeId}`;

const byStart = (a: IncidentStop, b: IncidentStop) =>
  a.start.getTime() - b.start.getTime() ||
  a.occurrenceId.localeCompare(b.occurrenceId);

function joins(
  incident: StopIncident,
  next: IncidentStop,
  options: IncidentOptions,
): boolean {
  if (incident.end === null || options.breaks.has(next.occurrenceId)) {
    return false;
  }
  const gap = (next.start.getTime() - incident.end.getTime()) / 1000;
  return gap <= options.windowSeconds;
}

function extend(incident: StopIncident, next: IncidentStop): void {
  incident.occurrenceIds.push(next.occurrenceId);
  if (next.end === null) {
    incident.end = null;
  } else if (incident.end !== null && next.end > incident.end) {
    incident.end = next.end;
  }
}

const open = (stop: IncidentStop): StopIncident => ({
  firstOccurrenceId: stop.occurrenceId,
  unitId: stop.unitId,
  assetId: stop.assetId,
  reasonCodeId: stop.reasonCodeId as string,
  occurrenceIds: [stop.occurrenceId],
  start: stop.start,
  end: stop.end,
});

/**
 * SME D5 repeat grouping: stops of the same unit, asset (or unit-level) and reason (the failure mode)
 * starting within the window after the previous stop of the chain ended form one incident — a
 * stop-restart-stop sequence of one unresolved problem. Every stop stays its own event with its own
 * duration (S3: never merged into one stop); the incident is counted once in MTBF-style failure counts.
 * Stops without a reason are never grouped (the mode is unknown), an open stop ends its chain, and a stop
 * a person marked as a new failure after a verified repair starts a new chain. Only groups of two or more.
 */
export function groupIncidents(
  stops: readonly IncidentStop[],
  options: IncidentOptions,
): StopIncident[] {
  const chains = new Map<string, StopIncident[]>();
  for (const stop of [...stops].filter((s) => s.reasonCodeId).sort(byStart)) {
    const list = chains.get(keyOf(stop)) ?? [];
    chains.set(keyOf(stop), list);
    const last = list[list.length - 1];
    if (last && joins(last, stop, options)) extend(last, stop);
    else list.push(open(stop));
  }
  return [...chains.values()]
    .flat()
    .filter((incident) => incident.occurrenceIds.length > 1)
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.firstOccurrenceId.localeCompare(b.firstOccurrenceId),
    );
}

/** Physical stopped seconds of an incident's stops (S3: the stops, never the incident envelope). */
export function stoppedSeconds(
  incident: StopIncident,
  stops: ReadonlyMap<string, IncidentStop>,
  asOf: Date,
): number {
  return incident.occurrenceIds.reduce((total, id) => {
    const stop = stops.get(id);
    if (!stop) return total;
    const end = stop.end ?? asOf;
    return total + Math.max(0, end.getTime() - stop.start.getTime()) / 1000;
  }, 0);
}
