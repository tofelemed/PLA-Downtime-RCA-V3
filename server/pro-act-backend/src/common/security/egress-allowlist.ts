/**
 * Connector egress allowlist (plan 3.11 step 3, NFR02): `CONNECTOR_EGRESS_ALLOWLIST` lists the hosts
 * outbound connector calls may reach — `pi.plant.local`, `*.corp.example` (any subdomain), optionally
 * with a port (`pi.plant.local:8443`). Unset or empty = no restriction (development); production sets it.
 */
export function parseEgressAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function hostMatches(pattern: string, host: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern;
}

/** Whether `url` may be called; malformed URLs never are. */
export function isEgressAllowed(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const allowlist = parseEgressAllowlist(env.CONNECTOR_EGRESS_ALLOWLIST);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (allowlist.length === 0) return true;
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port;
  return allowlist.some((entry) => {
    const [pattern, entryPort] = entry.split(':');
    if (entryPort && entryPort !== port) return false;
    return hostMatches(pattern, host);
  });
}
