import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { LossLineListQueryDto } from './loss-lines-v2.dto';

const UNIT = '2f1b4a6e-1111-4c3d-8e9f-000000000001';

function parse(query: Record<string, unknown>): Promise<LossLineListQueryDto> {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: LossLineListQueryDto,
  }) as Promise<LossLineListQueryDto>;
}

async function rejectedFields(
  query: Record<string, unknown>,
): Promise<string[]> {
  try {
    await parse(query);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationFailedException);
    return (error as ValidationFailedException).fieldErrors.map((f) => f.field);
  }
  throw new Error('expected validation to fail');
}

describe('LossLineListQueryDto (UX G-3 picker)', () => {
  it('accepts single and repeated filters as arrays', async () => {
    const parsed = await parse({
      unitIds: UNIT,
      reasonCodeIds: [UNIT, UNIT],
      kinds: 'availability',
      q: 'feed',
      sort: '-periodStart',
    });
    expect(parsed.unitIds).toEqual([UNIT]);
    expect(parsed.reasonCodeIds).toHaveLength(2);
    expect(parsed.kinds).toEqual(['availability']);
    expect(parsed.limit).toBe(100);
  });

  it('rejects non-loss kinds, other sorts, non-uuid ids, empty text and unknown fields', async () => {
    expect(await rejectedFields({ kinds: ['residual'] })).toContain('kinds');
    expect(await rejectedFields({ sort: 'periodStart' })).toContain('sort');
    expect(await rejectedFields({ unitIds: 'x' })).toContain('unitIds');
    expect(await rejectedFields({ q: '' })).toContain('q');
    expect(await rejectedFields({ tenant: 'x' })).toContain('tenant');
  });
});
