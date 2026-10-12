import { NotFoundException } from '@nestjs/common';

/**
 * Resolves a lookup that answers `null`/`undefined` for an absent row into the row itself, or rejects
 * with `NotFoundException` (404 NOT_FOUND) naming the entity and id. v1 get / update / delete use it so an
 * unknown id is reported instead of answering 200 with an empty body.
 */
export async function findOrThrow<T>(
  lookup: Promise<T | null | undefined>,
  entity: string,
  id: string,
): Promise<T> {
  const found = await lookup;
  if (found === null || found === undefined) {
    throw new NotFoundException(`${entity} ${id} not found`);
  }
  return found;
}
