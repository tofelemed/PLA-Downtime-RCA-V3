import { humanize } from './humanize';

/** Shown for the state engine, recalculation jobs, connectors and other automatic actors. */
export const SYSTEM_ACTOR = 'System';

/** Automatic services and sources as people read them (the "System (…)" suffix). */
export const SERVICE_LABELS: Readonly<Record<string, string>> = {
  'accounting-worker': 'accounting recalculation',
  'actuals-worker': 'actuals recalculation',
  worker: 'background job',
  'state-engine': 'state engine',
  state_engine: 'state engine',
  connector: 'integration source',
  'stop-reconciliation': 'stop reconciliation',
  'unit-impact': 'unit impact rule',
  'data-repair': 'data repair',
  'event-operations': 'split / merge',
  system: '',
};

/**
 * Who acted on a record, as the server reports it. `kind` is the server's actor kind (`user`, `connector`,
 * `system`, …); a record that only carries ids is a user when it has an `id`, the system otherwise.
 */
export interface ActorRef {
  kind?: string | null;
  id?: string | null;
  /** the name the server already resolved (preferred: no lookup) */
  name?: string | null;
  /** the service or source that acted (`service`, connector name) */
  source?: string | null;
}

/** "System" with the source in brackets when known, e.g. "System (state engine)". */
export function systemActorText(source?: string | null): string {
  if (!source) return SYSTEM_ACTOR;
  const label = source in SERVICE_LABELS ? SERVICE_LABELS[source] : humanize(source);
  return label ? `${SYSTEM_ACTOR} (${label})` : SYSTEM_ACTOR;
}

/**
 * The one actor wording (owner finding 1): a person's name (server-resolved, else `nameOf` from
 * `useUserNames`, which reads "Former user" for ids outside the plant), or "System (source)" for automatic
 * actors — never "a user" and never an id.
 */
export function actorText(actor: ActorRef, nameOf: (id: string) => string): string {
  const isSystem = actor.kind != null && actor.kind !== 'user';
  if (isSystem) return systemActorText(actor.source ?? actor.kind);
  const name = actor.name?.trim();
  if (name) return name;
  return actor.id ? nameOf(actor.id) : systemActorText(actor.source);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FORMER_USER_TEXT = 'Former user';

/**
 * An actor the server already looked up (`{ id, name }` pairs such as `actorName`, `createdByName`,
 * month-close `PersonRef`): the name; "Former user" when a user id has no name any more; "System (…)" when
 * there is no user id (or the id is a service token such as `system`).
 */
export function resolvedActorText(id: string | null | undefined, name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  if (id && UUID.test(id)) return FORMER_USER_TEXT;
  return systemActorText(id && id !== 'system' ? id : null);
}
