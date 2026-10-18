const CHUNK_MESSAGE =
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading (css )?chunk [\w-]+ failed|unable to preload css/i;

/**
 * True when a lazily loaded page (or its CSS) could not be downloaded: usually a new deployment replaced
 * the chunk or the connection dropped. Only a full reload fixes it.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_MESSAGE.test(error.message);
}
