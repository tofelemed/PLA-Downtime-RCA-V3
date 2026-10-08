import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { UpdateLossCategoryDto } from './update-loss-category.dto';

const pipe = createValidationPipe();

describe('UpdateLossCategoryDto (B4)', () => {
  it('accepts categoryName and the other loss_categories columns', async () => {
    const payload = {
      categoryName: 'Mechanical',
      lossAmount: 42,
      description: 'Bearing failure',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateLossCategoryDto,
      }),
    ).resolves.toEqual(payload);
  });

  it('rejects the old `name` field that never matched a column', async () => {
    await expect(
      pipe.transform(
        { name: 'Mechanical' },
        { type: 'body', metatype: UpdateLossCategoryDto },
      ),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });
});
