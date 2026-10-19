import { EntityManager } from 'typeorm';
import { Dec } from '../../domain/actuals/decimal';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { classSummary, NOT_BY_SCHEDULE_CLASS } from './downtime-class-summary';
import { summaryOf } from './downtime-report';
import { KpiAggregateView } from './kpi-reports-v2.view';
import { breakdownGroups } from './report-sql';
import { ReportScope } from './report-scope';

jest.mock('./downtime-report', () => ({ summaryOf: jest.fn() }));
jest.mock('./report-sql', () => ({ breakdownGroups: jest.fn() }));

const view = (metric: KpiMetric, value: string | null): KpiAggregateView => ({
  metric,
  numerator: value,
  denominator: null,
  value,
  unit: 's',
  quality: 'ok',
  reason: null,
  rows: 2,
  missing: 0,
});

const manager = {} as EntityManager;
const scope = {} as ReportScope;

describe('classSummary (the downtime summary follows the schedule class filter)', () => {
  beforeEach(() => {
    jest
      .mocked(summaryOf)
      .mockResolvedValue([
        view('downtime_total', '5400'),
        view('downtime_planned', '0'),
        view('downtime_unplanned', '5400'),
        view('stop_count', '2'),
        view('scheduled_availability', '0.9375'),
      ]);
    jest
      .mocked(breakdownGroups)
      .mockImplementation((_m, _s, spec) =>
        Promise.resolve(
          spec.metric === 'downtime_total'
            ? [{ key: 'total', amount: new Dec('3600'), periods: 1 }]
            : [{ key: 'total', amount: new Dec('1'), periods: 1 }],
        ),
      );
  });

  it('stop time and count from the class cells, the class KPI as stored, the rest without a value', async () => {
    const result = await classSummary(manager, scope, {
      scheduleClass: 'unplanned',
      includeMicroStops: false,
    });
    const of = (metric: string) => result.find((v) => v.metric === metric);
    expect(of('downtime_total')).toMatchObject({
      value: '3600',
      quality: 'ok',
    });
    expect(of('stop_count')?.value).toBe('1');
    expect(of('downtime_unplanned')?.value).toBe('5400');
    expect(of('downtime_planned')).toMatchObject({
      value: null,
      quality: 'unavailable',
      reason: NOT_BY_SCHEDULE_CLASS,
    });
    expect(of('scheduled_availability')).toMatchObject({
      value: null,
      reason: NOT_BY_SCHEDULE_CLASS,
    });
    const spec = jest.mocked(breakdownGroups).mock.calls[0][2];
    expect(spec).toMatchObject({
      dimension: 'none',
      scheduleClass: 'unplanned',
      includeMicroStops: false,
    });
  });

  it('a class without stops reads zero, not the whole-window figure', async () => {
    jest.mocked(breakdownGroups).mockResolvedValue([]);
    const result = await classSummary(manager, scope, {
      scheduleClass: 'planned',
      includeMicroStops: false,
    });
    expect(result.find((v) => v.metric === 'downtime_total')?.value).toBe('0');
    expect(result.find((v) => v.metric === 'stop_count')?.value).toBe('0');
    expect(result.find((v) => v.metric === 'downtime_planned')?.value).toBe(
      '0',
    );
  });
});
