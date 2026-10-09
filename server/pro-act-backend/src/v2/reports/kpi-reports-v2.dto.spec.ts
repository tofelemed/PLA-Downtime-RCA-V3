import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import {
  DowntimeReportQueryDto,
  OeeReportQueryDto,
  ReliabilityReportQueryDto,
} from './kpi-reports-v2.dto';

const UNIT = '2f1b4a6e-1111-4c3d-8e9f-000000000001';
const WINDOW = { from: '2027-03-01T00:00:00Z', to: '2027-03-02T00:00:00Z' };

function parse<T>(metatype: new () => T, query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype,
  }) as Promise<T>;
}

async function rejectedFields<T>(
  metatype: new () => T,
  query: Record<string, unknown>,
): Promise<string[]> {
  try {
    await parse(metatype, query);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationFailedException);
    return (error as ValidationFailedException).fieldErrors.map((f) => f.field);
  }
  throw new Error('expected validation to fail');
}

describe('KPI report queries (plan 2.7)', () => {
  it('accepts a window with a single unit, groupBy and policy; booleans read "false" as false', async () => {
    const parsed = await parse(OeeReportQueryDto, {
      ...WINDOW,
      unitIds: UNIT,
      groupBy: 'week',
      policy: 'reconciled',
      approvedOnly: 'false',
    });
    expect(parsed.unitIds).toEqual([UNIT]);
    expect(parsed.approvedOnly).toBe(false);
  });

  it('needs instants with an offset and allowlisted enums', async () => {
    expect(
      await rejectedFields(OeeReportQueryDto, {
        from: '2027-03-01',
        to: WINDOW.to,
        groupBy: 'year',
        policy: 'average',
      }),
    ).toEqual(expect.arrayContaining(['from', 'groupBy', 'policy']));
    expect(
      await rejectedFields(DowntimeReportQueryDto, {
        ...WINDOW,
        metric: 'cost',
        scheduleClass: 'micro',
      }),
    ).toEqual(expect.arrayContaining(['metric', 'scheduleClass']));
  });

  it('refuses non-uuid ids and unknown parameters (tenant from identity)', async () => {
    expect(
      await rejectedFields(ReliabilityReportQueryDto, {
        ...WINDOW,
        assetIds: ['not-a-uuid'],
        unitIds: ['x'],
      }),
    ).toEqual(expect.arrayContaining(['assetIds', 'unitIds']));
    expect(
      await rejectedFields(OeeReportQueryDto, { ...WINDOW, oee: '0.87' }),
    ).toEqual(['oee']);
  });
});
