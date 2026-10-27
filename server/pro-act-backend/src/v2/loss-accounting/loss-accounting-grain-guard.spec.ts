import { EntityManager } from 'typeorm';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import {
  LOSS_ACCOUNTING_DEFAULT,
  LossAccountingPolicy,
} from '../../periods/loss-accounting-policy';
import { assertSupportedGrainChange } from './loss-accounting-grain-guard';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const DAILY: LossAccountingPolicy = {
  ...LOSS_ACCOUNTING_DEFAULT,
  grain: 'day',
  dayStart: '00:00',
  lossBasis: 'declared',
  targetSource: 'declared',
  accountingUnitId: U1,
};

const managerWith = (marked: number) =>
  ({
    count: jest.fn(() => Promise.resolve(marked)),
  }) as unknown as EntityManager;

const draftOf = (body: Partial<LossAccountingPolicy>) =>
  ({
    tenantId: 't1',
    unitId: U1,
    body: { ...DAILY, ...body },
  }) as unknown as AccountingPolicy;

const base = {
  row: { unitId: U1 } as AccountingPolicy,
  body: DAILY,
};

const refusal = { response: { code: 'GRAIN_CHANGE_UNSUPPORTED' } };

describe('assertSupportedGrainChange', () => {
  it.each([
    ['back to shifts', { grain: 'shift' as const }],
    ['another day start', { dayStart: '06:00' }],
    ['another accounting unit', { accountingUnitId: U2 }],
  ])(
    'refuses %s once the daily calendar is in force or pending',
    async (_l, change) => {
      await expect(
        assertSupportedGrainChange(managerWith(1), draftOf(change), base),
      ).rejects.toMatchObject(refusal);
    },
  );

  it('a settings-only version (product, tolerance, target) passes', async () => {
    await expect(
      assertSupportedGrainChange(
        managerWith(1),
        draftOf({ identityTolerance: 2, targetSource: 'plan' }),
        base,
      ),
    ).resolves.toBeUndefined();
  });

  it('without a marked daily calendar, or from a shift version, any change passes', async () => {
    await expect(
      assertSupportedGrainChange(
        managerWith(0),
        draftOf({ grain: 'shift' }),
        base,
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertSupportedGrainChange(
        managerWith(1),
        draftOf({ dayStart: '06:00' }),
        {
          ...base,
          body: LOSS_ACCOUNTING_DEFAULT,
        },
      ),
    ).resolves.toBeUndefined();
  });
});
