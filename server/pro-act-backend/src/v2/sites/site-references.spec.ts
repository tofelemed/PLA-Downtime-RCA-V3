import { HttpException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertSiteOfPlant, siteNamesOfPlant } from './site-references';

const PLANT = '11111111-1111-4111-8111-111111111111';
const DEFAULT_ID = '33333333-3333-4333-8333-333333333333';
const NORTH_ID = '44444444-4444-4444-8444-444444444444';

function managerReturning(rows: unknown[]) {
  const query = jest.fn(() => Promise.resolve(rows));
  return { manager: { query } as unknown as EntityManager, query };
}

describe('site references of units', () => {
  it('resolves site names with one query; null means the default site', async () => {
    const { manager, query } = managerReturning([
      { id: DEFAULT_ID, name: 'Plant One', is_default: true },
      { id: NORTH_ID, name: 'North', is_default: false },
    ]);
    const nameOf = await siteNamesOfPlant(manager, PLANT);
    expect(nameOf(null)).toBe('Plant One');
    expect(nameOf(undefined)).toBe('Plant One');
    expect(nameOf(NORTH_ID)).toBe('North');
    expect(nameOf('99999999-9999-4999-8999-999999999999')).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('has no default name before the plant has a site', async () => {
    const { manager } = managerReturning([]);
    expect((await siteNamesOfPlant(manager, PLANT))(null)).toBeNull();
  });

  it('accepts null / absent and a site of the plant; anything else is 422 SITE_NOT_IN_PLANT', async () => {
    const empty = managerReturning([]);
    await expect(
      assertSiteOfPlant(empty.manager, PLANT, null),
    ).resolves.toBeUndefined();
    expect(empty.query).not.toHaveBeenCalled();
    await expect(
      assertSiteOfPlant(managerReturning([{}]).manager, PLANT, NORTH_ID),
    ).resolves.toBeUndefined();
    const error = await assertSiteOfPlant(empty.manager, PLANT, NORTH_ID).catch(
      (caught: HttpException) => caught,
    );
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(422);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'SITE_NOT_IN_PLANT',
      fieldErrors: [{ field: 'siteId' }],
    });
  });
});
