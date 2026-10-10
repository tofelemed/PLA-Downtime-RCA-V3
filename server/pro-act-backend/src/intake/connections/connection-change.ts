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

/**
 * Endpoint settings that cannot redirect a credential or weaken TLS (paging and timing only). Every
 * other key - URL, host, port, scheme, username, TLS options, unknown keys - binds the stored secret.
 */
const CREDENTIAL_NEUTRAL_KEYS: ReadonlySet<string> = new Set([
  'pageSize',
  'maxCount',
  'batchSize',
  'timeoutMs',
  'pollIntervalSeconds',
  'overlapSeconds',
]);

/**
 * A stored credential is only valid for the endpoint it was entered for: any change to the endpoint
 * configuration other than paging/timing keys (another host, port, scheme, username, TLS setting or
 * an unknown key) must re-enter the credential in the same request, or 422 SECRET_REQUIRED - otherwise
 * the stored secret could be sent to a new, possibly attacker-controlled destination.
 */
export function assertSecretFollowsTarget(
  connection: Pick<IntegrationConnection, 'endpointConfig' | 'secretRef'>,
  change: ConnectionChange,
): void {
  if (!connection.secretRef || change.secret !== undefined) return;
  if (!change.endpointConfig) return;
  if (
    bindingKeysEqual(connection.endpointConfig ?? {}, change.endpointConfig)
  ) {
    return;
  }
  throw new UnprocessableEntityException({
    code: 'SECRET_REQUIRED',
    message:
      'Re-enter the credential when changing the endpoint target, user or TLS settings',
    fieldErrors: [
      { field: 'secret', message: 'required when the endpoint changes' },
    ],
  });
}

function bindingKeysEqual(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !CREDENTIAL_NEUTRAL_KEYS.has(key))
    .every((key) => JSON.stringify(before[key]) === JSON.stringify(after[key]));
}
