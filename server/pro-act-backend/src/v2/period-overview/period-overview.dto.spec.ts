import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { PeriodSummaryQueryDto } from './period-overview.dto';

async function parse(
  query: Record<string, unknown>,
): Promise<PeriodSummaryQueryDto> {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: PeriodSummaryQueryDto,
  }) as Promise<PeriodSummaryQueryDto>;
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

describe('PeriodSummaryQueryDto (UX D-5 / D-6 options)', () => {
  it('sorts by utcStart in both directions', async () => {
    expect((await parse({ sort: 'utcStart' })).sort).toBe('utcStart');
    expect((await parse({ sort: '-utcStart' })).sort).toBe('-utcStart');
    expect(await rejectedFields({ sort: 'localDate' })).toContain('sort');
  });

  it('accepts residual states as a single or repeated parameter', async () => {
    expect(
      (await parse({ residualStates: 'unaccounted' })).residualStates,
    ).toEqual(['unaccounted']);
    expect(
      (await parse({ residualStates: ['over_accounted', 'conflict'] }))
        .residualStates,
    ).toEqual(['over_accounted', 'conflict']);
  });

  it('refuses residual states outside the grid vocabulary', async () => {
    expect(await rejectedFields({ residualStates: 'missing' })).toContain(
      'residualStates',
    );
  });

  it('still refuses undeclared parameters such as planId', async () => {
    await expect(parse({ planId: 'x' })).rejects.toBeInstanceOf(
      ValidationFailedException,
    );
  });
});
