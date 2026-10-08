import { createHash } from 'crypto';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { CanonicalEnvelope } from './canonical-envelope';
import { CANONICAL_EVENT_SCHEMA } from './canonical-event.schema';

/** One schema violation in a form that can be stored and returned (no ajv internals). */
export interface EnvelopeViolation {
  path: string;
  message: string;
}

export type EnvelopeValidation =
  | { valid: true; envelope: CanonicalEnvelope }
  | { valid: false; violations: EnvelopeViolation[] };

let compiled: ValidateFunction<CanonicalEnvelope> | null = null;

/** The ajv validator of the canonical envelope, compiled once per process. */
function validator(): ValidateFunction<CanonicalEnvelope> {
  if (compiled) return compiled;
  // `required` inside if/then names properties declared at the top level, hence strictRequired off
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  compiled = ajv.compile<CanonicalEnvelope>(CANONICAL_EVENT_SCHEMA);
  return compiled;
}

/** Validates one envelope at the adapter boundary (plan 1.5 step 1). */
export function validateEnvelope(candidate: unknown): EnvelopeValidation {
  const validate = validator();
  if (validate(candidate)) return { valid: true, envelope: candidate };
  return {
    valid: false,
    violations: (validate.errors ?? []).map(toViolation),
  };
}

function toViolation(error: ErrorObject): EnvelopeViolation {
  return {
    path: error.instancePath || '/',
    message: error.message ?? error.keyword,
  };
}

/** Canonical JSON (sorted keys) so equal content always hashes equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** `sha256:<hex>` of the canonical JSON of `payload` (the envelope's `payloadHash`). */
export function payloadHash(payload: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(payload)).digest('hex')}`;
}
