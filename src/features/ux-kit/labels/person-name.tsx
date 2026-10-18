import { actorText, type ActorRef } from './actor-labels';
import { useUserNames } from './use-user-names';

export interface PersonNameProps {
  id: string | null | undefined;
  /** a name the server already returned (shown as is, no lookup) */
  name?: string | null;
}

/**
 * A person's display name from a user id (owner finding 1): plant members from the cached directory,
 * other ids batched into one lookup per render pass; "Former user" when the plant does not know the id.
 */
export function PersonName({ id, name }: PersonNameProps) {
  const users = useUserNames(id && !name ? [id] : []);
  return <span data-testid="person-name">{name?.trim() || users.nameOf(id)}</span>;
}

/** Who acted on a record: the person's name, or "System (source)" for automatic actors. */
export function ActorName({ actor }: { actor: ActorRef }) {
  const isUser = !actor.kind || actor.kind === 'user';
  const users = useUserNames(isUser && actor.id && !actor.name ? [actor.id] : []);
  return <span data-testid="actor-name">{actorText(actor, users.nameOf)}</span>;
}
