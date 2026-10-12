import { useMemo } from 'react';

/** Resolves an id to its display name; never returns the id (docs/UI_UX_AUDIT.md §6). */
export interface NameResolver {
  /** the name, `fallback` ("Unknown unit") when the id is not known, "—" when there is no id */
  nameOf(id: string | null | undefined): string;
  /** true while the directory is first loading (callers may show a skeleton instead of the fallback) */
  isLoading: boolean;
}

interface Named {
  id: string;
  name: string | null;
}

/** A memoized resolver over the loaded directory entries. */
export function useNameResolver(entries: readonly Named[] | undefined, isLoading: boolean, fallback: string): NameResolver {
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of entries ?? []) {
      const name = entry.name?.trim();
      if (name) names.set(entry.id, name);
    }
    return {
      nameOf: (id) => (id ? names.get(id) ?? fallback : '—'),
      isLoading,
    };
  }, [entries, isLoading, fallback]);
}
