import { UnprocessableEntityException } from '@nestjs/common';
import { ValidationFailedException } from '../common/errors/validation-failed.exception';
import { createValidationPipe } from '../common/validation/validation-pipe.factory';
import { DeclaredFigures } from '../domain/events/declared-figures';
import { DeclaredFiguresDto } from '../v2/production-events/declared-figures.dto';
import { assertProductionLossValid } from './production-loss';

const figures = (shortfall: number): DeclaredFigures => ({
  planned: 100,
  actual: 100 - shortfall,
  shortfall,
  uom: 't',
  measurementQuality: null,
  sourceStatus: 'CONFIRMED',
  plan: null,
  piSource: null,
});

const END = new Date('2027-03-02T02:30:00Z');

describe('a negative declared shortfall', () => {
  it('is refused by the DTO (Min 0)', async () => {
    const parse = createValidationPipe().transform(
      { planned: 100, actual: 110, shortfall: -10 },
      { type: 'body', metatype: DeclaredFiguresDto },
    );
    await expect(parse).rejects.toBeInstanceOf(ValidationFailedException);
  });

  it('is refused by the write model whatever path wrote it (422)', () => {
    const write = () =>
      assertProductionLossValid({
        endTime: END,
        columns: { quantity: -10, declaredFigures: figures(-10) },
      });
    expect(write).toThrow(UnprocessableEntityException);
    try {
      write();
    } catch (error) {
      expect(
        (error as UnprocessableEntityException).getResponse(),
      ).toMatchObject({ code: 'VALIDATION_FAILED' });
    }
  });

  it('a shortfall of 0 or more passes', () => {
    expect(() =>
      assertProductionLossValid({
        endTime: END,
        columns: { quantity: 0, declaredFigures: figures(0) },
      }),
    ).not.toThrow();
  });
});
