import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CalendarVersionListQueryDto } from './calendar-version-v2.dto';

const pipe = createValidationPipe();
const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: CalendarVersionListQueryDto,
  }) as Promise<CalendarVersionListQueryDto>;

describe('CalendarVersionListQueryDto.siteOnly (site calendars without unit overrides)', () => {
  it('reads the query-string boolean as sent, "false" included', async () => {
    await expect(parse({ siteOnly: 'true' })).resolves.toMatchObject({
      siteOnly: true,
    });
    await expect(parse({ siteOnly: 'false' })).resolves.toMatchObject({
      siteOnly: false,
    });
    expect((await parse({})).siteOnly).toBeUndefined();
  });

  it('refuses anything else', async () => {
    await expect(parse({ siteOnly: 'maybe' })).rejects.toBeInstanceOf(
      ValidationFailedException,
    );
  });
});
