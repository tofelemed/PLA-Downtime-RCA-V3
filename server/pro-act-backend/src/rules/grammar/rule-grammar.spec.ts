import { readFileSync } from 'fs';
import { resolve } from 'path';
import { globMatches, StepBudget } from './glob';
import { RuleDefinition } from './rule-definition';
import { RULE_DEFINITION_SCHEMA } from './rule-definition.schema';
import { evaluateRule } from './rule-interpreter';
import { validateRuleDefinition } from './rule-validator';

const CONTRACTS = resolve(__dirname, '../../../../../contracts/rules');
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));
const T22 = readJson(
  resolve(CONTRACTS, 'examples/t22-long-downtime-unplanned.json'),
) as RuleDefinition;

const errorsOf = (
  kind: Parameters<typeof validateRuleDefinition>[0],
  candidate: unknown,
) => {
  const result = validateRuleDefinition(kind, candidate);
  return result.valid ? [] : result.fieldErrors;
};

describe('rule grammar (plan 3.8, NFR02)', () => {
  it('the checked copy equals contracts/rules/rule-definition.schema.json', () => {
    expect(JSON.parse(JSON.stringify(RULE_DEFINITION_SCHEMA))).toEqual(
      readJson(resolve(CONTRACTS, 'rule-definition.schema.json')),
    );
  });

  it('accepts the T22 example', () => {
    expect(validateRuleDefinition('coding_default', T22)).toMatchObject({
      valid: true,
      conditionCount: 2,
    });
  });

  it('rejects fields and operators outside the allowlist with paths', () => {
    expect(
      errorsOf('coding_default', {
        when: { all: [{ field: 'constructor', op: 'eq', value: 'x' }] },
        then: T22.then,
      }),
    ).toEqual([
      expect.objectContaining({ field: 'definition.when.all.0.field' }),
    ]);
    expect(
      errorsOf('coding_default', {
        when: { all: [{ field: 'physicalType', op: 'eval', value: 'x' }] },
        then: T22.then,
      }),
    ).toEqual([expect.objectContaining({ field: 'definition.when.all.0.op' })]);
    expect(
      errorsOf('coding_default', {
        when: { all: [{ field: 'physicalType', op: 'gt', value: 'downtime' }] },
        then: T22.then,
      }),
    ).toEqual([expect.objectContaining({ field: 'definition.when.all.0.op' })]);
  });

  it('never accepts code: function strings and unknown keys are refused', () => {
    const fn = {
      when: {
        all: [{ field: 'source', op: 'eq', value: 'x', fn: 'return true' }],
      },
      then: T22.then,
    };
    expect(errorsOf('coding_default', fn)[0].field).toBe(
      'definition.when.all.0',
    );
    expect(
      errorsOf('coding_default', { ...T22, condition: '() => true' })[0]
        .message,
    ).toContain('condition');
  });

  it('checks value types, list operators and actions per kind', () => {
    const when = (value: unknown, op = 'gte') => ({
      when: { all: [{ field: 'durationSeconds', op, value }] },
      then: T22.then,
    });
    expect(errorsOf('coding_default', when('3600'))[0]).toEqual({
      field: 'definition.when.all.0.value',
      message: 'must be a number',
    });
    expect(errorsOf('coding_default', when(3600, 'in'))[0].message).toContain(
      'list',
    );
    expect(
      errorsOf('coding_default', {
        ...T22,
        then: [{ set: 'scheduleClass', value: 'sometimes' }],
      })[0].field,
    ).toBe('definition.then.0.value');
    expect(
      errorsOf('coding_default', { ...T22, then: [{ flag: 'rca' }] })[0].field,
    ).toBe('definition.then.0.flag');
    expect(
      errorsOf('rca_trigger_hint', {
        ...T22,
        then: [{ flag: 'rca_recommended' }],
      }),
    ).toEqual([]);
    expect(errorsOf('status_derivation', T22)[0].field).toBe(
      'definition.then.0.set',
    );
  });

  it('bounds nesting to two levels and conditions to 20', () => {
    const condition = { field: 'durationSeconds', op: 'gt', value: 1 };
    const deep = {
      when: { all: [{ any: [{ all: [condition] }] }] },
      then: T22.then,
    };
    expect(errorsOf('coding_default', deep).length).toBeGreaterThan(0);
    const many = {
      when: {
        all: [
          { all: Array(11).fill(condition) },
          { any: Array(11).fill(condition) },
        ],
      },
      then: T22.then,
    };
    const [only, ...rest] = errorsOf('coding_default', many);
    expect(rest).toEqual([]);
    expect(only.field).toBe('definition.when');
    expect(only.message).toContain('22 conditions');
  });

  it('evaluates the T22 rule deterministically', () => {
    const long = { physicalType: 'downtime', durationSeconds: 3600 };
    expect(evaluateRule(T22, long)).toMatchObject({
      matched: true,
      actions: T22.then,
      budgetExceeded: false,
    });
    expect(
      evaluateRule(T22, { physicalType: 'downtime', durationSeconds: 3599 })
        .matched,
    ).toBe(false);
    expect(
      evaluateRule(T22, { physicalType: 'slowdown', durationSeconds: 7200 })
        .matched,
    ).toBe(false);
    expect(
      evaluateRule(T22, { physicalType: 'downtime', durationSeconds: null })
        .matched,
    ).toBe(false);
    expect(evaluateRule(T22, long)).toEqual(
      evaluateRule(JSON.parse(JSON.stringify(T22)) as RuleDefinition, long),
    );
  });

  it('supports any / in / neq / exists / matches and nested groups', () => {
    const definition = {
      when: {
        any: [
          { field: 'source', op: 'matches', value: 'PI*frame?' },
          {
            all: [
              { field: 'eventType', op: 'in', value: ['APM', 'FailureWO'] },
              { field: 'assetId', op: 'exists' },
            ],
          },
        ],
        all: [{ field: 'sourceKind', op: 'neq', value: 'manual' }],
      },
      then: [{ flag: 'review' }],
    } as RuleDefinition;
    expect(
      evaluateRule(definition, {
        source: 'pi event FRAMES',
        sourceKind: 'source',
      }).matched,
    ).toBe(true);
    expect(
      evaluateRule(definition, {
        eventType: 'APM',
        assetId: 'a',
        sourceKind: 'source',
      }).matched,
    ).toBe(true);
    expect(
      evaluateRule(definition, { eventType: 'APM', sourceKind: 'source' })
        .matched,
    ).toBe(false);
    expect(
      evaluateRule(definition, { source: 'PI frames', sourceKind: 'manual' })
        .matched,
    ).toBe(false);
  });

  it('stops at the step budget instead of running unbounded', () => {
    const definition = {
      when: { all: [{ field: 'source', op: 'matches', value: '*a*a*a*a*b' }] },
      then: [{ flag: 'x' }],
    } as RuleDefinition;
    const result = evaluateRule(definition, { source: 'a'.repeat(200) }, 50);
    expect(result).toMatchObject({ matched: false, budgetExceeded: true });
  });

  it('glob: escapes, wildcards, case-insensitive', () => {
    const budget = () => new StepBudget(10_000);
    expect(globMatches('a\\*b', 'a*b', budget())).toBe(true);
    expect(globMatches('a\\*b', 'axb', budget())).toBe(false);
    expect(globMatches('*.Pump?', 'unit.PUMP1', budget())).toBe(true);
    expect(globMatches('', '', budget())).toBe(true);
  });
});
