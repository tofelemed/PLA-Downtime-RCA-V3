/**
 * Which automatic service or source made an event revision or coding revision (owner finding 1, audit-trail
 * practice: an automatic actor is attributable too — "System (state engine)", never a bare "System"). The
 * writers store `actor_kind` (`user` / `connector` / `system`) but no service name, so the source is derived
 * from what the revision does record: its change reason (each automatic writer words its own), its kind and
 * how the event entered Pro-Act. User revisions have no source (the person is named instead).
 *
 * Returned keys are service keys (`state-engine`, `stop-reconciliation`, `unit-impact`, `data-repair`,
 * `event-operations`) or, for connector and import revisions, the event's own source name
 * as stored (`production_events.source`); null when nothing recorded says more than "system".
 */
export interface ActorSourceInput {
  /** `user` / `connector` / `system` (revisions); null author ⇒ `system` for coding revisions */
  actorKind: string;
  /** revision kind (`source`, `user`, `system`, `retraction`) or `coding` */
  kind: string;
  reason: string | null;
}

export interface ActorSourceEvent {
  sourceKind: string | null;
  source: string | null;
}

const REASON_SOURCES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^state engine\b/i, 'state-engine'],
  [/^unit impact\b/i, 'unit-impact'],
  [/^repair:/i, 'data-repair'],
  [/duplicate stop|stop it was merged into/i, 'stop-reconciliation'],
  [/^(split|merge)\b/i, 'event-operations'],
];

/** Kinds a state-engine-derived event receives from the engine itself (creation, reprocessing, retraction). */
const ENGINE_KINDS: ReadonlySet<string> = new Set([
  'source',
  'retraction',
  'coding',
]);

function namedSource(event: ActorSourceEvent): string | null {
  const name = event.source?.trim();
  return name ? name : null;
}

export function revisionActorSource(
  input: ActorSourceInput,
  event: ActorSourceEvent,
): string | null {
  if (input.actorKind === 'user') return null;
  const reason = input.reason?.trim() ?? '';
  const byReason = REASON_SOURCES.find(([pattern]) => pattern.test(reason));
  if (byReason) return byReason[1];
  if (input.actorKind === 'connector') return namedSource(event) ?? 'connector';
  if (event.sourceKind === 'derived' && ENGINE_KINDS.has(input.kind)) {
    return 'state-engine';
  }
  if (event.sourceKind === 'source' || event.sourceKind === 'imported') {
    return input.kind === 'source' || input.kind === 'coding'
      ? namedSource(event)
      : null;
  }
  return null;
}
