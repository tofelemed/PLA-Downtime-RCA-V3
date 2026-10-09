import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

/**
 * Plan 0.2 steps 3-5: every accounting policy default validates against its
 * policy-kind schema, and every schema compiles under JSON Schema 2020-12
 * (strict mode, formats enabled). Paths resolve from this file so the spec
 * runs under any Jest rootDir.
 */
const POLICIES_DIR = resolve(__dirname, '../../../../contracts/policies');
const DEFAULTS_DIR = resolve(POLICIES_DIR, 'defaults');
const SCHEMA_BASE = 'https://proact.local/contracts/policies/';
const PLACEHOLDER_TENANT = '00000000-0000-0000-0000-000000000000';
const VERSIONED_DEFAULT = /^([a-z_]+)\.v(\d+)\.default\.json$/;

type JsonObject = Record<string, unknown>;

interface PolicyDocument extends JsonObject {
  policyKind: string;
  version: number;
  effectiveFrom: string;
  scope: { tenantId: string };
  body: JsonObject;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPolicyDocument(value: unknown): value is PolicyDocument {
  return (
    isJsonObject(value) &&
    typeof value.policyKind === 'string' &&
    typeof value.version === 'number' &&
    typeof value.effectiveFrom === 'string' &&
    isJsonObject(value.scope) &&
    typeof value.scope.tenantId === 'string' &&
    isJsonObject(value.body)
  );
}

function readJson(path: string): JsonObject {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isJsonObject(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  return parsed;
}

function readPolicyDefault(kind: string): PolicyDocument {
  const doc = readJson(resolve(DEFAULTS_DIR, `${kind}.default.json`));
  if (!isPolicyDocument(doc)) {
    throw new Error(`${kind}.default.json is missing envelope fields`);
  }
  return doc;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return JSON.stringify(errors ?? [], null, 2);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const envelope = readJson(resolve(POLICIES_DIR, 'policy-envelope.schema.json'));
const envelopeDefs = isJsonObject(envelope.$defs) ? envelope.$defs : {};
const policyKindDef = isJsonObject(envelopeDefs.policyKind)
  ? envelopeDefs.policyKind
  : {};
const kinds: string[] = Array.isArray(policyKindDef.enum)
  ? policyKindDef.enum.filter((k): k is string => typeof k === 'string')
  : [];

const schemaFiles = readdirSync(POLICIES_DIR)
  .filter(
    (f) => f.endsWith('.schema.json') && f !== 'policy-envelope.schema.json',
  )
  .map((f) => f.replace(/\.schema\.json$/, ''));
const defaultFiles = readdirSync(DEFAULTS_DIR)
  .filter((f) => f.endsWith('.default.json') && !VERSIONED_DEFAULT.test(f))
  .map((f) => f.replace(/\.default\.json$/, ''));
/** Later seeded versions of a kind (`<kind>.v<n>.default.json`), e.g. the D08 IRR / USD valuation policy. */
const versionedFiles = readdirSync(DEFAULTS_DIR).filter((f) =>
  VERSIONED_DEFAULT.test(f),
);

const ajv = new Ajv2020({
  strict: true,
  strictTypes: true,
  allErrors: true,
  allowUnionTypes: true,
});
addFormats(ajv);
ajv.addSchema(envelope);

/** Reuses Ajv's own registry so a failed compile re-throws its real error on retry. */
function validatorFor(kind: string): ValidateFunction {
  const existing = ajv.getSchema(`${SCHEMA_BASE}${kind}.schema.json`);
  if (existing) return existing;
  return ajv.compile(readJson(resolve(POLICIES_DIR, `${kind}.schema.json`)));
}

describe('contracts/policies', () => {
  it('declares nine policy kinds, each with exactly one schema and one default', () => {
    expect(kinds).toHaveLength(9);
    expect([...schemaFiles].sort()).toEqual([...kinds].sort());
    expect([...defaultFiles].sort()).toEqual([...kinds].sort());
  });

  describe.each(kinds)('%s', (kind) => {
    it('schema compiles under 2020-12 strict mode with formats', () => {
      const schema = readJson(resolve(POLICIES_DIR, `${kind}.schema.json`));
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      expect(schema.$id).toBe(`${SCHEMA_BASE}${kind}.schema.json`);
      expect(schema.additionalProperties).toBe(false);
      expect(typeof schema.description).toBe('string');
      expect(() => validatorFor(kind)).not.toThrow();
    });

    it('pins policyKind to the file name', () => {
      const schema = readJson(resolve(POLICIES_DIR, `${kind}.schema.json`));
      const properties = isJsonObject(schema.properties)
        ? schema.properties
        : {};
      const policyKind = isJsonObject(properties.policyKind)
        ? properties.policyKind
        : {};
      expect(policyKind.const).toBe(kind);
    });

    it('default validates and carries the seeding placeholders', () => {
      const doc = readPolicyDefault(kind);
      const validate = validatorFor(kind);
      const valid = validate(doc);
      expect(formatErrors(validate.errors)).toBe('[]');
      expect(valid).toBe(true);
      expect(doc.policyKind).toBe(kind);
      expect(doc.version).toBe(1);
      expect(doc.scope.tenantId).toBe(PLACEHOLDER_TENANT);
      expect(doc.notes).toEqual(expect.stringContaining('placeholder'));
    });

    it('default body validates alone against #/$defs/body (stored jsonb column)', () => {
      validatorFor(kind);
      const bodyValidator = ajv.getSchema(
        `${SCHEMA_BASE}${kind}.schema.json#/$defs/body`,
      );
      expect(bodyValidator).toBeDefined();
      const doc = readPolicyDefault(kind);
      expect(bodyValidator?.(doc.body)).toBe(true);
    });

    it('rejects unknown fields, a foreign policyKind and a malformed tenant id', () => {
      const validate = validatorFor(kind);
      const base = readPolicyDefault(kind);

      const extraTop = clone(base);
      extraTop.unexpected = true;
      expect(validate(extraTop)).toBe(false);

      const extraBody = clone(base);
      extraBody.body.unexpected = true;
      expect(validate(extraBody)).toBe(false);

      const wrongKind = clone(base);
      wrongKind.policyKind =
        kind === 'oee_policy' ? 'rca_policy' : 'oee_policy';
      expect(validate(wrongKind)).toBe(false);

      const badTenant = clone(base);
      badTenant.scope.tenantId = 'not-a-uuid';
      expect(validate(badTenant)).toBe(false);
    });
  });

  it('reconciliation_tolerance: mode zero forces value 0 and percent caps at 100', () => {
    const validate = validatorFor('reconciliation_tolerance');
    const zeroWithValue = readPolicyDefault('reconciliation_tolerance');
    zeroWithValue.body.value = 1;
    expect(validate(zeroWithValue)).toBe(false);

    const percent = readPolicyDefault('reconciliation_tolerance');
    percent.body.mode = 'percent';
    percent.body.value = 0.1;
    expect(validate(percent)).toBe(true);
    percent.body.value = 101;
    expect(validate(percent)).toBe(false);
  });

  it('approval_roles: forbidSelfApproval cannot be switched off', () => {
    const validate = validatorFor('approval_roles');
    const doc = readPolicyDefault('approval_roles');
    doc.body.forbidSelfApproval = false;
    expect(validate(doc)).toBe(false);
  });

  it('calendar_defaults: local times and weekdays are range-checked', () => {
    const validate = validatorFor('calendar_defaults');
    const doc = readPolicyDefault('calendar_defaults');
    doc.body.operationalDayStart = '24:00';
    expect(validate(doc)).toBe(false);

    const weekday = readPolicyDefault('calendar_defaults');
    const templates = weekday.body.shiftTemplates;
    if (!Array.isArray(templates) || !isJsonObject(templates[0])) {
      throw new Error('shiftTemplates fixture shape changed');
    }
    templates[0].daysOfWeek = [0];
    expect(validate(weekday)).toBe(false);
  });

  it.each(versionedFiles)(
    '%s validates as a later version of its kind',
    (file) => {
      const [, kind, version] = VERSIONED_DEFAULT.exec(file) ?? [];
      const doc = readJson(resolve(DEFAULTS_DIR, file));
      const validate = validatorFor(kind);
      expect(validate(doc)).toBe(true);
      expect(formatErrors(validate.errors)).toBe('[]');
      expect(doc.policyKind).toBe(kind);
      expect(doc.version).toBe(Number(version));
      expect(Number(version)).toBeGreaterThan(1);
    },
  );

  it('valuation_basis: version 2 reports IRR and USD, version 1 keeps the XXX placeholder', () => {
    const v1 = readPolicyDefault('valuation_basis');
    const v2 = readJson(
      resolve(DEFAULTS_DIR, 'valuation_basis.v2.default.json'),
    ) as PolicyDocument;
    expect(v1.body.currency).toBe('XXX');
    expect(v2.body.reportingCurrencies).toEqual(['IRR', 'USD']);
    expect(v2.body.fxPolicy).toBe('snapshot');
    const validate = validatorFor('valuation_basis');
    const both = clone(v2);
    both.body.currency = 'IRR';
    expect(validate(both)).toBe(false);
    const neither = clone(v2);
    delete neither.body.reportingCurrencies;
    expect(validate(neither)).toBe(false);
  });

  it('micro-stop thresholds agree between oee_policy and state_rules defaults', () => {
    const oee = readPolicyDefault('oee_policy');
    const state = readPolicyDefault('state_rules');
    expect(oee.body.microStopSeconds).toBe(state.body.microStopSeconds);
  });
});
