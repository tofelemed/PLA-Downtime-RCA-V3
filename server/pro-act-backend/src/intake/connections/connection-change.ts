import { BadGatewayException, ConflictException } from '@nestjs/common';
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
