import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { UpdateReconcileFormDto } from './update-reconcile-form.dto';

const pipe = createValidationPipe();

describe('UpdateReconcileFormDto (B3)', () => {
  it('accepts a partial set of the form columns', async () => {
    const payload = {
      status: 'Approved',
      comment: 'Reviewed',
      categorizedLossAmount: 120.5,
      categories: '[]',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateReconcileFormDto,
      }),
    ).resolves.toEqual(payload);
  });

  it('rejects the stale plan-shaped fields', async () => {
    await expect(
      pipe.transform(
        { period: '2026-10' },
        { type: 'body', metatype: UpdateReconcileFormDto },
      ),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });
});
