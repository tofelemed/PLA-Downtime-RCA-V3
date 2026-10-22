import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { UnitV2ChangeDto, UnitV2CreateDto } from '../units/unit-v2.dto';
import {
  SitesListQueryDto,
  SiteV2ChangeDto,
  SiteV2CreateDto,
} from './site-v2.dto';

const pipe = createValidationPipe();
const SITE_ID = '6f1c2f7e-4d3b-4a8e-9c1d-2b3a4c5d6e7f';

function parse<T>(
  metatype: new () => T,
  value: unknown,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

async function rejects(
  metatype: new () => unknown,
  value: unknown,
  type: 'body' | 'query' = 'body',
): Promise<boolean> {
  try {
    await parse(metatype, value, type);
    return false;
  } catch {
    return true;
  }
}

describe('v2 site DTOs', () => {
  it('trims the name and accepts an IANA zone and an HH:MM day start', async () => {
    const site = await parse(SiteV2CreateDto, {
      name: '  North yard ',
      timezone: 'Asia/Tehran',
      operationalDayStart: '07:30',
    });
    expect(site).toMatchObject({
      name: 'North yard',
      timezone: 'Asia/Tehran',
      operationalDayStart: '07:30',
    });
    expect(await parse(SiteV2CreateDto, { name: 'South' })).toMatchObject({
      name: 'South',
    });
  });

  it('rejects blank or long names, unknown zones, bad day starts and undeclared fields', async () => {
    expect(await rejects(SiteV2CreateDto, { name: '   ' })).toBe(true);
    expect(await rejects(SiteV2CreateDto, { name: 'x'.repeat(256) })).toBe(
      true,
    );
    expect(
      await rejects(SiteV2CreateDto, { name: 'A', timezone: 'Mars/Base' }),
    ).toBe(true);
    for (const start of ['24:00', '7:30', '07:60', '07:30:00']) {
      expect(
        await rejects(SiteV2CreateDto, {
          name: 'A',
          operationalDayStart: start,
        }),
      ).toBe(true);
    }
    expect(await rejects(SiteV2CreateDto, { name: 'A', isDefault: true })).toBe(
      true,
    );
  });

  it('rename takes the name only', async () => {
    expect(await parse(SiteV2ChangeDto, { name: ' B ' })).toMatchObject({
      name: 'B',
    });
    expect(await rejects(SiteV2ChangeDto, {})).toBe(true);
    expect(
      await rejects(SiteV2ChangeDto, { name: 'B', timezone: 'Asia/Tehran' }),
    ).toBe(true);
  });

  it('list query sorts by name or creation time only', async () => {
    expect(
      await parse(SitesListQueryDto, { sort: '-name', q: 'yard' }, 'query'),
    ).toMatchObject({ sort: '-name', q: 'yard' });
    expect(await rejects(SitesListQueryDto, { sort: 'code' }, 'query')).toBe(
      true,
    );
  });

  it('unit create / change take an optional site id (uuid or null)', async () => {
    const unit = { code: 'U1', name: 'Unit' };
    expect(
      await parse(UnitV2CreateDto, { ...unit, siteId: SITE_ID }),
    ).toMatchObject({ siteId: SITE_ID });
    expect(
      await parse(UnitV2CreateDto, { ...unit, siteId: null }),
    ).toMatchObject({ siteId: null });
    expect(await rejects(UnitV2CreateDto, { ...unit, siteId: 'north' })).toBe(
      true,
    );
    expect(await parse(UnitV2ChangeDto, { siteId: null })).toMatchObject({
      siteId: null,
    });
    expect(await rejects(UnitV2ChangeDto, { siteId: 42 })).toBe(true);
  });
});
