import { createValidationPipe } from '../../../common/validation/validation-pipe.factory';
import {
  AssetV2CreateDto,
  AssetV2ListQueryDto,
} from '../../assets/asset-v2.dto';
import { ProductV2ListQueryDto } from '../../products/product-v2.dto';
import {
  RcaTemplateV2CreateDto,
  VerificationChecklistV2CreateDto,
} from '../../rca-settings/rca-settings-v2.dto';
import { UnitV2ChangeDto, UnitV2CreateDto } from '../../units/unit-v2.dto';
import { MasterDataListQueryDto } from './master-data-list-query.dto';
import { containsPattern } from './search';

const pipe = createValidationPipe();
const UNIT_ID = '6f1c2f7e-4d3b-4a8e-9c1d-2b3a4c5d6e7f';

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

describe('v2 master-data DTOs', () => {
  it('trims codes and names and accepts legacy decimals as strings', async () => {
    const unit = await parse(UnitV2CreateDto, {
      code: '  EXT-1 ',
      name: ' Extruder ',
      capacity: '12.5',
    });
    expect(unit).toMatchObject({
      code: 'EXT-1',
      name: 'Extruder',
      capacity: '12.5',
    });
    expect(await rejects(UnitV2CreateDto, { code: '   ', name: 'x' })).toBe(
      true,
    );
    expect(
      await rejects(UnitV2CreateDto, { code: 'A', name: 'x', capacity: -1 }),
    ).toBe(true);
    expect(
      await rejects(UnitV2CreateDto, {
        code: 'A',
        name: 'x',
        tenantId: UNIT_ID,
      }),
    ).toBe(true);
    expect(
      await parse(UnitV2ChangeDto, {
        capacity: null,
        idealCycleTimeSeconds: '60.25',
      }),
    ).toMatchObject({ capacity: null });
  });

  it('allowlists list sorts and statuses and turns repeated unit ids into an array', async () => {
    expect(
      await rejects(MasterDataListQueryDto, { sort: 'description' }, 'query'),
    ).toBe(true);
    expect(
      await rejects(MasterDataListQueryDto, { status: 'deleted' }, 'query'),
    ).toBe(true);
    expect(
      await parse(
        MasterDataListQueryDto,
        { sort: '-code', status: 'retired', q: 'line' },
        'query',
      ),
    ).toMatchObject({
      sort: '-code',
      status: 'retired',
    });
    const assets = await parse(
      AssetV2ListQueryDto,
      { unitIds: UNIT_ID },
      'query',
    );
    expect(assets.unitIds).toEqual([UNIT_ID]);
    const products = await parse(
      ProductV2ListQueryDto,
      { includeOrganization: 'false' },
      'query',
    );
    expect(products.includeOrganization).toBe(false);
  });

  it('validates asset criticality, checklist colours and logic tree nodes', async () => {
    expect(
      await rejects(AssetV2CreateDto, {
        code: 'P',
        name: 'Pump',
        unitId: UNIT_ID,
        criticality: 'Severe',
      }),
    ).toBe(true);
    expect(
      await rejects(VerificationChecklistV2CreateDto, {
        code: 'V',
        name: 'x',
        color: 'blue',
      }),
    ).toBe(true);
    expect(
      await rejects(VerificationChecklistV2CreateDto, {
        code: 'V',
        name: 'x',
        items: [''],
      }),
    ).toBe(true);
    const node = { id: 'n1', name: 'Seal', code: 'S', category: 'Equipment' };
    expect(
      await rejects(RcaTemplateV2CreateDto, {
        name: 't',
        category: 'c',
        logicTree: [{ ...node, category: 'Luck' }],
      }),
    ).toBe(true);
    const nested = await parse(RcaTemplateV2CreateDto, {
      name: 't',
      category: 'c',
      logicTree: [{ ...node, children: [{ ...node, id: 'n2' }] }],
    });
    expect(nested.logicTree?.[0].children?.[0].id).toBe('n2');
  });

  it('escapes LIKE wildcards in searches', () => {
    expect(containsPattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});
