import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CrewRotationCreateDto } from './crew-v2.dto';

const pipe = createValidationPipe();
const validate = (pattern: Record<string, unknown>) =>
  pipe.transform(
    {
      crewId: '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d',
      pattern,
      effectiveFrom: '2026-10-10',
    },
    { type: 'body', metatype: CrewRotationCreateDto },
  );

describe('CrewRotationCreateDto.pattern.cycle (null = day off)', () => {
  it('accepts a cycle with days off', async () => {
    const cycle = ['A', 'A', 'B', 'B', null];
    await expect(
      validate({ anchorDate: '2026-10-05', cycle }),
    ).resolves.toMatchObject({ pattern: { cycle } });
  });

  it('still rejects non-string slots, empty names and names over 64 characters', async () => {
    for (const cycle of [
      ['A', 7],
      ['A', ''],
      ['A', 'x'.repeat(65)],
      ['A', undefined],
      [],
    ]) {
      await expect(
        validate({ anchorDate: '2026-10-05', cycle }),
      ).rejects.toBeInstanceOf(ValidationFailedException);
    }
  });
});
