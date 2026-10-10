import {
  BadGatewayException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { adapterErrorOf } from '../adapters/adapter-error';
import { IntegrationConnection } from '../entities/integration-connection.entity';

/** A partial change of a connection (PATCH /connections/{id}). */
export interface ConnectionChange {
  displayName?: string;
  endpointConfig?: Record<string, unknown>;
  secret?: string;
  isActive?: boolean;
}

export function pickChange(
  change: ConnectionChange,
): Partial<IntegrationConnection> {
  const fields: Partial<IntegrationConnection> = {};
  if (change.displayName !== undefined) fields.displayName = change.displayName;
  if (change.endpointConfig !== undefined) {
    fields.endpointConfig = change.endpointConfig;
  }
  if (change.isActive !== undefined) fields.isActive = change.isActive;
  return fields;
}

/** v1 PI connections are mirrored on every v1 save/pull, so a v2 edit would be overwritten. */
export async function assertNotLegacyMirror(
  manager: EntityManager,
  id: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    'SELECT 1 FROM pi_connections WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return;
  throw new ConflictException({
    code: 'LEGACY_CONNECTION',
    message:
      'This connection mirrors a v1 PI connection; edit it in the v1 PI Integration screen',
  });
}

/** A classified source failure (auth, authz, unreachable ...) as 502 with the adapter code. */
export function sourceFailure(error: unknown): never {
  const adapterError = adapterErrorOf(error);
  if (!adapterError) throw error;
  throw new BadGatewayException({
    code: adapterError.code,
    message: adapterError.message,
  });
}

/** Endpoint keys that decide where a stored credential is sent. */
const TARGET_KEY_PATTERN = /url|host|broker|endpoint|server|port/i;
const INSECURE_TLS_KEY = 'allowInsecureTls';

/**
 * A stored credential is only valid for the target it was entered for: moving the endpoint to another
 * origin/host/port, or switching TLS verification off, without re-entering the credential would send
 * the stored secret to a new, possibly attacker-controlled destination. 422 SECRET_REQUIRED then.
 */
export function assertSecretFollowsTarget(
  connection: Pick<IntegrationConnection, 'endpointConfig' | 'secretRef'>,
  change: ConnectionChange,
): void {
  if (
    !connection.secretRef ||
    change.secret !== undefined ||
    !change.endpointConfig
  )
    return;
  const before = targetSignature(connection.endpointConfig);
  const after = targetSignature(change.endpointConfig);
  if (before === after) return;
  throw new UnprocessableEntityException({
    code: 'SECRET_REQUIRED',
    message:
      'Re-enter the credential when changing the endpoint target or TLS verification',
    fieldErrors: [
      { field: 'secret', message: 'required when the endpoint target changes' },
    ],
  });
}

function targetSignature(
  config: Record<string, unknown> | null | undefined,
): string {
  const entries = Object.entries(config ?? {})
    .filter(([key]) => TARGET_KEY_PATTERN.test(key))
    .map(([key, value]) => [key, normalizeTarget(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const insecure = config?.[INSECURE_TLS_KEY] === true;
  return JSON.stringify({ entries, insecure });
}

function normalizeTarget(value: unknown): string {
  if (typeof value !== 'string') return JSON.stringify(value ?? null);
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}
