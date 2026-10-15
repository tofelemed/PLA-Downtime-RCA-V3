import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import {
  DowntimeBundleQueryDto,
  DowntimeReportQueryDto,
} from './kpi-reports-v2.dto';
import { selectionOf } from './report-scope';
import { params } from './report-sql';

const WINDOW = { from: '2027-03-01T00:00:00Z', to: '2027-03-02T00:00:00Z' };
const PRODUCT = '2f1b4a6e-1111-4c3d-8e9f-000000000002';
const CREW = '2f1b4a6e-1111-4c3d-8e9f-000000000003';

function parse<T>(metatype: new () => T, query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype,
  }) as Promise<T>;
}

describe('downtime period selection (product, shift, crew filters)', () => {
  it('reads single and repeated parameters on the report and the bundle', async () => {
    const report = await parse(DowntimeReportQueryDto, {
      ...WINDOW,
      productIds: PRODUCT,
      shiftNames: ['B', 'A', 'A'],
      crewIds: CREW,
    });
    expect(selectionOf(report)).toEqual({
      productIds: [PRODUCT],
      shiftNames: ['A', 'B'],
      crewIds: [CREW],
    });
    const bundle = await parse(DowntimeBundleQueryDto, {
      ...WINDOW,
      views: 'reason',
      shiftNames: 'Night',
    });
    expect(selectionOf(bundle)).toEqual({ shiftNames: ['Night'] });
  });

  it('refuses non-uuid product and crew ids', async () => {
    await expect(
      parse(DowntimeReportQueryDto, {
        ...WINDOW,
        productIds: 'x',
        crewIds: 'y',
      }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });

  it('no filter: no selection, and the SQL parameter carries approvedOnly only', () => {
    expect(selectionOf({})).toBeUndefined();
    const scope = {
      tenantId: 't',
      unitIds: ['u'],
      restricted: null,
      from: new Date(WINDOW.from),
      to: new Date(WINDOW.to),
      approvedOnly: true,
      weekStart: 'saturday' as const,
    };
    expect(JSON.parse(params(scope)[4] as string)).toEqual({
      approvedOnly: true,
    });
    expect(
      JSON.parse(
        params({ ...scope, selection: { crewIds: [CREW] } })[4] as string,
      ),
    ).toEqual({ approvedOnly: true, crewIds: [CREW] });
  });
});
