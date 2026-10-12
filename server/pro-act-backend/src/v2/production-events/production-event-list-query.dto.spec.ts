import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { LIST_LIMIT_DEFAULT } from '../common/list-query.dto';
import { ProductionEventListQueryDto } from './production-event-list-query.dto';

const UNIT_A = '2f1b4a6e-1111-4c3d-8e9f-000000000001';
const UNIT_B = '2f1b4a6e-1111-4c3d-8e9f-000000000002';

async function parse(
  query: Record<string, unknown>,
): Promise<ProductionEventListQueryDto> {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: ProductionEventListQueryDto,
  }) as Promise<ProductionEventListQueryDto>;
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

describe('ProductionEventListQueryDto (v2 list query)', () => {
  it('defaults limit to 100 and leaves optional filters undefined', async () => {
    const parsed = await parse({});
    expect(parsed.limit).toBe(LIST_LIMIT_DEFAULT);
    expect(parsed.unitIds).toBeUndefined();
    expect(parsed.isOpen).toBeUndefined();
  });

  it('coerces limit from the query string and enforces 1..500', async () => {
    expect((await parse({ limit: '250' })).limit).toBe(250);
    expect(await rejectedFields({ limit: '0' })).toContain('limit');
    expect(await rejectedFields({ limit: '501' })).toContain('limit');
    expect(await rejectedFields({ limit: 'many' })).toContain('limit');
  });

  it('accepts repeated and single array parameters', async () => {
    expect((await parse({ unitIds: [UNIT_A, UNIT_B] })).unitIds).toEqual([
      UNIT_A,
      UNIT_B,
    ]);
    expect((await parse({ unitIds: UNIT_A })).unitIds).toEqual([UNIT_A]);
    expect((await parse({ eventTypes: 'ProductionLoss' })).eventTypes).toEqual([
      'ProductionLoss',
    ]);
  });

  it('rejects non-uuid ids inside array filters', async () => {
    expect(await rejectedFields({ unitIds: ['nope'] })).toContain('unitIds');
    expect(await rejectedFields({ reasonIds: UNIT_A + 'x' })).toContain(
      'reasonIds',
    );
  });

  it('parses booleans from text without the implicit-conversion trap', async () => {
    expect((await parse({ isOpen: 'false' })).isOpen).toBe(false);
    expect((await parse({ isOpen: 'true' })).isOpen).toBe(true);
    expect(await rejectedFields({ isOpen: 'maybe' })).toContain('isOpen');
  });

  it('allowlists sort fields', async () => {
    expect((await parse({ sort: '-startTime' })).sort).toBe('-startTime');
    expect((await parse({ sort: 'startTime' })).sort).toBe('startTime');
    expect(await rejectedFields({ sort: 'unitId' })).toContain('sort');
    expect(await rejectedFields({ sort: 'startTime; DROP TABLE' })).toContain(
      'sort',
    );
  });

  it('requires ISO 8601 window bounds', async () => {
    const parsed = await parse({
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-02',
    });
    expect(parsed.from).toBe('2026-10-01T00:00:00Z');
    expect(await rejectedFields({ from: 'yesterday' })).toContain('from');
  });

  it('filters by source kind (enum) and severity labels', async () => {
    const parsed = await parse({
      sourceKinds: ['manual', 'source'],
      severities: 'Critical',
    });
    expect(parsed.sourceKinds).toEqual(['manual', 'source']);
    expect(parsed.severities).toEqual(['Critical']);
    expect(await rejectedFields({ sourceKinds: 'pi' })).toContain(
      'sourceKinds',
    );
    expect(
      await rejectedFields({ severities: Array(11).fill('High') }),
    ).toContain('severities');
    expect(await rejectedFields({ severities: 'x'.repeat(31) })).toContain(
      'severities',
    );
  });

  it('trims the text search and bounds it to 2..100 characters', async () => {
    expect((await parse({ q: '  pump trip ' })).q).toBe('pump trip');
    expect(await rejectedFields({ q: ' a ' })).toContain('q');
    expect(await rejectedFields({ q: 'x'.repeat(101) })).toContain('q');
    expect(await rejectedFields({ q: ['ab', 'cd'] })).toContain('q');
  });

  it('rejects undeclared parameters such as tenantId', async () => {
    expect(await rejectedFields({ tenantId: UNIT_A })).toContain('tenantId');
    expect(await rejectedFields({ page: '2' })).toContain('page');
  });
});
