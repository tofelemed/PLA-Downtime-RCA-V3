import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

const pipe = createValidationPipe();

describe('CreateProductDto (B18)', () => {
  it('accepts tenantId, unitId, organizationId and isActive', async () => {
    const payload = {
      name: 'HDPE Film Grade',
      code: 'HDPE-F1',
      tenantId: '2f1b4a6e-2222-4c3d-8e9f-000000000001',
      unitId: '2f1b4a6e-1111-4c3d-8e9f-000000000001',
      organizationId: '2f1b4a6e-3333-4c3d-8e9f-000000000001',
      isActive: false,
    };

    await expect(
      pipe.transform(payload, { type: 'body', metatype: CreateProductDto }),
    ).resolves.toMatchObject(payload);
  });

  it('still rejects undeclared fields', async () => {
    await expect(
      pipe.transform(
        { name: 'x', code: 'y', colour: 'red' },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });

  it('update DTO shares the same optional field set', async () => {
    await expect(
      pipe.transform(
        { unitId: 'unit100', isActive: true },
        { type: 'body', metatype: UpdateProductDto },
      ),
    ).resolves.toEqual({ unitId: 'unit100', isActive: true });
  });
});
