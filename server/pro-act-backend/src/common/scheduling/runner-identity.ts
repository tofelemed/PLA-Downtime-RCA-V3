import { randomUUID } from 'crypto';
import { hostname } from 'os';

let identity: string | null = null;

/**
 * Lease owner name of this process (`<host>:<pid>:<random>`): stable for the process lifetime and
 * unique across restarts, so a restarted worker never mistakes an old lease for its own.
 */
export function runnerIdentity(): string {
  identity ??= `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  return identity;
}
