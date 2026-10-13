interface NamedCode {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/**
 * FE-05: resolves a code id to "CODE · Name" over every code of the library, retired ones included and
 * marked, so events coded before a code was retired keep their reason on screen.
 */
export function codeNameResolver(codes: readonly NamedCode[]): (id: string | null | undefined) => string {
  const byId = new Map(codes.map((c) => [c.id, `${c.code} · ${c.name}${c.active ? '' : ' (retired)'}`]));
  return (id) => (id ? byId.get(id) ?? 'Unknown' : '—');
}
