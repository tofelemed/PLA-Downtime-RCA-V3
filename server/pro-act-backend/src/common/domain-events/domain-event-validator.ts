import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { DOMAIN_EVENT_SCHEMAS } from './domain-event-schemas';

let compiled: Map<string, ValidateFunction> | null = null;

/** One ajv validator per message type with a published contract, compiled once per process. */
function validators(): Map<string, ValidateFunction> {
  if (compiled) return compiled;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  compiled = new Map(
    Object.entries(DOMAIN_EVENT_SCHEMAS).map(([type, schema]) => [
      type,
      ajv.compile(schema),
    ]),
  );
  return compiled;
}

/** Whether `type` is a versioned domain message with a schema (spec §15.4). */
export function hasDomainEventSchema(type: string): boolean {
  return validators().has(type);
}

/**
 * Schema violations of an outbox payload (API05): null when the type has no published contract or the
 * payload conforms; otherwise a short, storable description (no ajv internals).
 */
export function domainEventViolations(
  type: string,
  payload: unknown,
): string | null {
  const validate = validators().get(type);
  if (!validate || validate(payload)) return null;
  return (validate.errors ?? []).slice(0, 5).map(describe).join('; ');
}

function describe(error: ErrorObject): string {
  return `${error.instancePath || '/'} ${error.message ?? error.keyword}`;
}
