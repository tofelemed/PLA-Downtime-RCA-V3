import { UnprocessableEntityException } from '@nestjs/common';
import { IntegrationConnection } from '../entities/integration-connection.entity';
import { ConnectionChange } from './connection-change';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSON merge patch (RFC 7396): objects merge key by key, `null` removes a key, anything else replaces
 * the target value. A non-object target is replaced by the patch as a whole.
 */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isRecord(patch)) return patch;
  const result: Record<string, unknown> = isRecord(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = mergePatch(result[key], value);
  }
  return result;
}

/**
 * `payloadProfilePatch` of PATCH /connections/{id} (plan 1.8 design §3 "partial updates"): the patch is
 * merged into the stored `endpointConfig.payloadProfile` of an MQTT connection and the result travels
 * on as a whole `endpointConfig`, so the usual validation, duplicate-feed guard and credential-binding
 * rules apply unchanged and a value-map edit can never wipe the topics.
 */
export function resolveProfilePatch(
  connection: Pick<IntegrationConnection, 'sourceType' | 'endpointConfig'>,
  change: ConnectionChange,
): ConnectionChange {
  const { payloadProfilePatch: patch, ...rest } = change;
  if (patch === undefined) return change;
  if (connection.sourceType !== 'mqtt') {
    throw new UnprocessableEntityException({
      code: 'PROFILE_PATCH_UNSUPPORTED',
      message:
        'payloadProfilePatch applies to MQTT connections only; send the whole endpointConfig instead',
      fieldErrors: [
        { field: 'payloadProfilePatch', message: 'mqtt connections only' },
      ],
    });
  }
  if (change.endpointConfig !== undefined) {
    throw new UnprocessableEntityException({
      code: 'INVALID_CHANGE',
      message:
        'Send either endpointConfig (whole replace) or payloadProfilePatch (merge), not both',
      fieldErrors: [
        {
          field: 'payloadProfilePatch',
          message: 'conflicts with endpointConfig',
        },
      ],
    });
  }
  const stored = connection.endpointConfig ?? {};
  return {
    ...rest,
    endpointConfig: {
      ...stored,
      payloadProfile: mergePatch(stored.payloadProfile, patch),
    },
  };
}
