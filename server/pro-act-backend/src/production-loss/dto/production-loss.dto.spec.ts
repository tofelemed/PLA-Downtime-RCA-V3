import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CreateProductionLossDto } from './create-production-loss.dto';
import { UpdateProductionLossDto } from './update-production-loss.dto';

const pipe = createValidationPipe();

describe('production loss DTOs (B13)', () => {
  it('create accepts lossType, lossCategory, quantity, cost and description', async () => {
    const payload = {
      planId: '2f1b4a6e-4444-4c3d-8e9f-000000000001',
      period: '2026-10-07',
      actual: 900,
      shortRangePlan: 1000,
      losses: 100,
      unaccountedLoss: 20,
      action: 'Reconcile',
      lossType: 'Downtime',
      lossCategory: 'Mechanical',
      quantity: 80,
      cost: 1234.5,
      description: 'Extruder trip',
      tenantId: '2f1b4a6e-2222-4c3d-8e9f-000000000001',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: CreateProductionLossDto,
      }),
    ).resolves.toEqual(payload);
  });

  it('update accepts any subset of those columns', async () => {
    const payload = {
      cost: 10,
      description: 'Updated',
      lossCategory: 'Electrical',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateProductionLossDto,
      }),
    ).resolves.toEqual(payload);
  });

  it('keeps type checking for the new numeric fields', async () => {
    await expect(
      pipe.transform(
        { quantity: 'eighty' },
        { type: 'body', metatype: UpdateProductionLossDto },
      ),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });
});
