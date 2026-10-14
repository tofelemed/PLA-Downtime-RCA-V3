interface NamedCode {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/**
 * FE-05: resolves a code id to "CODE · Name" over every code of the library, retired ones included and
 * marked, so events coded before a code was retired keep their reason on screen. While the library is
 * still loading (`complete` false) an id not yet seen reads "…", not "Unknown".
 */
export function codeNameResolver(codes: readonly NamedCode[], complete = true): (id: string | null | undefined) => string {
  const byId = new Map(codes.map((c) => [c.id, `${c.code} · ${c.name}${c.active ? '' : ' (retired)'}`]));
  const missing = complete ? 'Unknown' : '…';
  return (id) => (id ? byId.get(id) ?? missing : '—');
}
