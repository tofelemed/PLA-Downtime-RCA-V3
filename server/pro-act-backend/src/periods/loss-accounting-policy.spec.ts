import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  LOSS_ACCOUNTING_DEFAULT,
  parseLossAccounting,
} from './loss-accounting-policy';
import { PolicyBodyError } from './policy-body-error';

describe('parseLossAccounting', () => {
  it('the default equals the contracts default', () => {
    const doc = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../contracts/policies/defaults/loss_accounting.default.json',
        ),
        'utf8',
      ),
    ) as { body: unknown };
    expect(LOSS_ACCOUNTING_DEFAULT).toEqual(doc.body);
  });

  it('parses the default unchanged and fills an empty body from it', () => {
    expect(parseLossAccounting(LOSS_ACCOUNTING_DEFAULT)).toEqual(
      LOSS_ACCOUNTING_DEFAULT,
    );
    expect(parseLossAccounting({})).toEqual(LOSS_ACCOUNTING_DEFAULT);
  });

  it('accepts a declared daily body and a declared per-shift body', () => {
    const daily = {
      ...LOSS_ACCOUNTING_DEFAULT,
      grain: 'day',
      dayStart: '07:30',
      lossBasis: 'declared',
      targetSource: 'declared',
      accountingUnitId: '0b5f7a52-8f0a-4a3e-9d55-3a6c2b3f1a10',
      identityTolerance: 0.5,
    };
    expect(parseLossAccounting(daily)).toEqual(daily);
    expect(parseLossAccounting({ ...daily, grain: 'shift' }).grain).toBe(
      'shift',
    );
  });

  it('normalises targetSource to plan when the basis is computed', () => {
    const parsed = parseLossAccounting({
      ...LOSS_ACCOUNTING_DEFAULT,
      lossBasis: 'computed',
      targetSource: 'declared',
    });
    expect(parsed.targetSource).toBe('plan');
  });

  it.each([
    ['unknown field', { extra: 1 }],
    ['bad dayStart', { dayStart: '6:00' }],
    ['dayStart out of range', { dayStart: '24:00' }],
    ['negative tolerance', { identityTolerance: -1 }],
    ['non-numeric tolerance', { identityTolerance: '1' }],
    ['bad accountingUnitId', { accountingUnitId: 'unit-1' }],
    ['bad grain', { grain: 'week' }],
    ['bad lossBasis', { lossBasis: 'guess' }],
    ['bad targetSource', { targetSource: 'ot' }],
    ['non-boolean stopsCrossCheck', { stopsCrossCheck: 'yes' }],
  ])('rejects %s', (_label, patch) => {
    expect(() =>
      parseLossAccounting({ ...LOSS_ACCOUNTING_DEFAULT, ...patch }),
    ).toThrow(PolicyBodyError);
  });

  it('rejects a body that is not an object', () => {
    expect(() => parseLossAccounting(null)).toThrow(PolicyBodyError);
    expect(() => parseLossAccounting([])).toThrow(PolicyBodyError);
  });
});
