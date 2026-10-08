import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { ProductionEventQueryDto } from './production-event-query.dto';

const UNIT = '2f1b4a6e-1111-4c3d-8e9f-000000000001';
const TENANT = '2f1b4a6e-2222-4c3d-8e9f-000000000001';

async function parse(
  query: Record<string, unknown>,
): Promise<ProductionEventQueryDto> {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: ProductionEventQueryDto,
  }) as Promise<ProductionEventQueryDto>;
}

async function rejectedFields(
  query: Record<string, unknown>,
): Promise<string[]> {
  try {
    await parse(query);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationFailedException);
    return (error as ValidationFailedException).fieldErrors.map(
      (fieldError) => fieldError.field,
    );
  }
  throw new Error('expected validation to fail');
}

describe('ProductionEventQueryDto (v1 GET /production-events)', () => {
  it('keeps every filter so they can be ANDed (B1)', async () => {
    const parsed = await parse({
      tenantId: TENANT,
      unitId: UNIT,
      status: 'Open',
      eventType: 'ProductionLoss',
      startDate: '2026-10-01T00:00:00Z',
      endDate: '2026-10-02T00:00:00Z',
    });
    expect(parsed).toMatchObject({
      tenantId: TENANT,
      unitId: UNIT,
      status: 'Open',
      eventType: 'ProductionLoss',
    });
    expect(parsed.startDate).toBe('2026-10-01T00:00:00Z');
    expect(parsed.page).toBeUndefined();
  });

  it('coerces paging numbers and caps pageSize at 500', async () => {
    const parsed = await parse({ page: '2', pageSize: '500' });
    expect(parsed).toMatchObject({ page: 2, pageSize: 500 });
    expect(await rejectedFields({ pageSize: '501' })).toContain('pageSize');
    expect(await rejectedFields({ page: '0' })).toContain('page');
  });

  it('parses isOpen from text', async () => {
    expect((await parse({ isOpen: 'false' })).isOpen).toBe(false);
    expect((await parse({ isOpen: 'true' })).isOpen).toBe(true);
  });

  it('rejects malformed ids, dates and undeclared parameters', async () => {
    expect(await rejectedFields({ unitId: 'not-a-uuid' })).toContain('unitId');
    expect(await rejectedFields({ startDate: 'last week' })).toContain(
      'startDate',
    );
    expect(await rejectedFields({ $gte: '1' })).toContain('$gte');
  });
});
