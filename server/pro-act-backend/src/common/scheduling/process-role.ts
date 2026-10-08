/**
 * Which half of the system this Node process runs (spec §4.1: one domain codebase, separately
 * deployable API and worker processes).
 *
 * - `api`    HTTP controllers only; schedulers off (`@Cron` providers stay inert).
 * - `worker` schedulers/jobs only; no HTTP API apart from the health probes on WORKER_PORT.
 * - `all`    both in one process. Default when PROCESS_ROLE is unset, so `npm run start:dev`
 *            keeps the historical single-process behaviour.
 */
export const PROCESS_ROLES = ['api', 'worker', 'all'] as const;

export type ProcessRole = (typeof PROCESS_ROLES)[number];

export function isProcessRole(value: string): value is ProcessRole {
  return (PROCESS_ROLES as readonly string[]).includes(value);
}

export function getProcessRole(
  env: NodeJS.ProcessEnv = process.env,
): ProcessRole {
  const raw = env.PROCESS_ROLE?.trim().toLowerCase();
  if (!raw) return 'all';
  if (isProcessRole(raw)) return raw;
  throw new Error(
    `PROCESS_ROLE must be one of ${PROCESS_ROLES.join(', ')} (got "${env.PROCESS_ROLE}")`,
  );
}

/** Cron/interval/timeout providers run everywhere except in the pure API process. */
export function runsSchedulers(role: ProcessRole): boolean {
  return role !== 'api';
}
