import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ContractProfileKind } from '../payload-profile';
import { MQTT_MESSAGE_SCHEMAS } from './mqtt-message-schemas';

/** One contract violation in a storable form (no ajv internals). */
export interface MessageViolation {
  path: string;
  message: string;
}

let compiled: Map<ContractProfileKind, ValidateFunction> | null = null;

/** One ajv validator per profile kind, compiled once per process. */
function validators(): Map<ContractProfileKind, ValidateFunction> {
  if (compiled) return compiled;
  // `required` inside if/then names properties declared at the top level, hence strictRequired off
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  compiled = new Map(
    (
      Object.entries(MQTT_MESSAGE_SCHEMAS) as Array<
        [ContractProfileKind, object]
      >
    ).map(([kind, schema]) => [kind, ajv.compile(schema)]),
  );
  return compiled;
}

/**
 * Violations of a parsed message against the v1 contract of its profile kind (empty = conforms).
 * Used by every profile decoder before any field is read (design §4.2 stage 2 → `SCHEMA_INVALID`).
 */
export function validateMqttMessage(
  kind: ContractProfileKind,
  message: unknown,
): MessageViolation[] {
  const validate = validators().get(kind);
  if (!validate) return [{ path: '/', message: `no contract for ${kind}` }];
  if (validate(message)) return [];
  return (validate.errors ?? []).map(toViolation);
}

/** `<path> <message>; …` of the first violations, for a quarantine detail. */
export function describeViolations(
  violations: readonly MessageViolation[],
  limit = 5,
): string {
  return violations
    .slice(0, limit)
    .map((violation) => `${violation.path} ${violation.message}`)
    .join('; ');
}

function toViolation(error: ErrorObject): MessageViolation {
  return {
    path: error.instancePath || '/',
    message: error.message ?? error.keyword,
  };
}
