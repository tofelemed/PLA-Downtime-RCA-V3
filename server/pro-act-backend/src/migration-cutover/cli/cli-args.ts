import { UUID_PATTERN } from '../remediation/remediation-types';

export interface CliArgs {
  command: string | null;
  flags: Record<string, string | true>;
}

/** `cmd --key value --switch` → { command, flags }; repeated keys keep the last value. */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  const flags: Record<string, string | true> = {};
  let command: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      if (command === null) command = token;
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

export function stringFlag(args: CliArgs, key: string): string | null {
  const value = args.flags[key];
  return typeof value === 'string' ? value : null;
}

export function tenantFlag(args: CliArgs): string | null {
  const tenant = stringFlag(args, 'tenant');
  if (tenant !== null && !UUID_PATTERN.test(tenant)) {
    throw new Error(`--tenant must be a tenant uuid, got "${tenant}"`);
  }
  return tenant;
}

export type RunMode =
  | { kind: 'dry-run' }
  | { kind: 'apply'; actor: string; confirmDatabase: string };

/**
 * Writes need all of `--apply`, `--actor "<name>"` and `--confirm-database <db>` (must equal the database
 * the script is connected to); anything less is a dry run.
 */
export function runMode(args: CliArgs): RunMode {
  if (args.flags.apply !== true) return { kind: 'dry-run' };
  const actor = stringFlag(args, 'actor');
  const confirmDatabase = stringFlag(args, 'confirm-database');
  if (!actor || !confirmDatabase) {
    throw new Error(
      '--apply needs --actor "<name>" and --confirm-database <database name>',
    );
  }
  return { kind: 'apply', actor, confirmDatabase };
}

export function assertConfirmedDatabase(
  mode: RunMode,
  connected: string,
): void {
  if (mode.kind === 'apply' && mode.confirmDatabase !== connected) {
    throw new Error(
      `--confirm-database ${mode.confirmDatabase} does not match the connected database ${connected}; nothing was written`,
    );
  }
}
