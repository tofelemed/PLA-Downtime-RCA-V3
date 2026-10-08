import { RequestContext } from '../../common/context/request-context';
import { ActorKind } from './event-revision.entity';

/** Who caused a revision (spec ING06 provenance). `id` is a user id, or null for connectors/system. */
export interface RevisionActor {
  id: string | null;
  kind: ActorKind;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SYSTEM_ACTOR: RevisionActor = { id: null, kind: 'system' };
export const CONNECTOR_ACTOR: RevisionActor = { id: null, kind: 'connector' };

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** The authenticated user of a request, or the system outside one (jobs, CLIs). */
export function actorFromContext(
  context: RequestContext | undefined,
): RevisionActor {
  return isUuid(context?.userId)
    ? { id: context.userId, kind: 'user' }
    : SYSTEM_ACTOR;
}
