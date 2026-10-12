/** A PATCH names only what changed, so a concurrent edit of another field is not overwritten. */
export function changedFields<T extends object>(next: T, stored: Partial<Record<keyof T, unknown>>): Partial<T> {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => (stored[key as keyof T] ?? null) !== value),
  ) as Partial<T>;
}
