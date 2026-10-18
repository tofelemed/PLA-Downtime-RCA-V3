/** Facts of the investigated event, already turned into display text by the screen. */
export interface EventCaseFacts {
  unitName: string;
  /** asset name, or null when the event has no asset */
  assetName: string | null;
  /** reason code name, or null when the event is not coded yet */
  reasonName: string | null;
  /** start in plant time */
  start: string;
  /** end in plant time, or null while the stop is ongoing */
  end: string | null;
  /** duration text (e.g. "59 h 4 min"), or null when unknown */
  duration: string | null;
}

const TITLE_MAX = 255;

/** Editable title of a case opened from an event: "Unit 100 · Die plate blockage · 2026-10-15 22:39". */
export function eventCaseTitle(facts: EventCaseFacts): string {
  return [facts.unitName, facts.reasonName ?? 'Stop', facts.start].join(' · ').slice(0, TITLE_MAX);
}

/** Editable problem statement from the event facts only (no judgement about the cause). */
export function eventCaseProblem(facts: EventCaseFacts): string {
  const where = facts.assetName ? `${facts.unitName}, ${facts.assetName}` : facts.unitName;
  const when = facts.end ? `from ${facts.start} to ${facts.end}` : `since ${facts.start} (ongoing)`;
  const length = facts.duration ? `, ${facts.duration}` : '';
  const reason = facts.reasonName ? `Reason recorded: ${facts.reasonName}.` : 'No reason recorded yet.';
  return `Stop on ${where} ${when}${length}. ${reason}`;
}
