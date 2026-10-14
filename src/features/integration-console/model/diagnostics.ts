import type { ConnectionTestView, DiagnosticStatus } from '@/api/v2/types/integrations';

export interface DiagnosticRow {
  key: string;
  label: string;
  status: DiagnosticStatus | 'not_run';
  detail: string | null;
}

/** PI01 order: each layer on its own; after the first failure the server skips the rest. */
export const PI_STEPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'dns', label: 'DNS lookup' },
  { key: 'tls', label: 'TLS' },
  { key: 'auth', label: 'Authentication' },
  { key: 'version', label: 'PI Web API version' },
  { key: 'authz', label: 'Authorization (AF asset servers)' },
  { key: 'read', label: 'Read (AF databases)' },
];

/** One row per step, as the server reported it; `not_run` until a test ran. */
export function diagnosticRows(test: ConnectionTestView | null): DiagnosticRow[] {
  return PI_STEPS.map((step) => {
    const check = test?.diagnostics?.[step.key];
    return { ...step, status: check?.status ?? 'not_run', detail: check?.detail ?? null };
  });
}

export type ConnectionHealth = 'not_tested' | 'connected' | 'auth_failed' | 'authz_failed' | 'unreachable' | 'failed';

/**
 * Health of the last test (1.6: `auth_failed` / `authz_failed` are reported separately from an
 * unreachable source). "Connected" only means the source answered — accounting needs mapping and jobs.
 */
export function connectionHealth(test: ConnectionTestView | null): ConnectionHealth {
  if (!test) return 'not_tested';
  if (test.connected) return 'connected';
  const failed = PI_STEPS.find((step) => test.diagnostics?.[step.key]?.status === 'failed')?.key;
  // on plain http the auth step is the first request: a source that never answered is unreachable
  if (failed === 'auth' && test.diagnostics?.auth?.detail?.startsWith('PI_UNREACHABLE')) return 'unreachable';
  if (failed === 'auth') return 'auth_failed';
  if (failed === 'authz' || failed === 'read') return 'authz_failed';
  if (failed === 'dns' || failed === 'tls') return 'unreachable';
  return 'failed';
}

export const HEALTH_LABEL: Record<ConnectionHealth, string> = {
  not_tested: 'Not tested',
  connected: 'Source reachable',
  auth_failed: 'Authentication failed',
  authz_failed: 'Not authorized to read AF',
  unreachable: 'Source unreachable',
  failed: 'Check failed',
};

/** Detected capabilities worth showing (batch controller, stream updates) as "name: yes/no". */
export function capabilityList(capabilities: Record<string, unknown> | undefined): string[] {
  return Object.entries(capabilities ?? {})
    .filter(([, value]) => typeof value === 'boolean')
    .map(([name, value]) => `${name}: ${value ? 'yes' : 'no'}`);
}
