import { complianceRows } from './coding-compliance';
import { GroupTerms } from '../../domain/kpi/aggregate';
import { KpiMetric } from '../../domain/kpi/kpi.types';

const none = () => new Map<KpiMetric, GroupTerms>();

describe('coding compliance (R9)', () => {
  it('joins the delay counts and the stored KPIs per crew, rounding delays to whole seconds', () => {
    const rows = complianceRows(
      [
        {
          group_key: 'c1',
          stops: 4,
          coded: 3,
          verified: 1,
          median_delay: '1800.4',
          p90_delay: '7200.9',
        },
      ],
      new Map([['c1', none()]]),
      (k) => (k === 'c1' ? 'Crew A' : null),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        key: 'c1',
        label: 'Crew A',
        stops: 4,
        coded: 3,
        verified: 1,
        medianDelaySeconds: '1800',
        p90DelaySeconds: '7201',
      }),
    ]);
    expect(rows[0].codedDowntimeRatio.value).toBeNull();
  });

  it('a shift with KPIs but no stops gets zero counts; the empty shift label is "none"', () => {
    const rows = complianceRows(
      [],
      new Map([
        ['', none()],
        ['A', none()],
      ]),
      (k) => k,
    );
    expect(rows.map((r) => r.key)).toEqual([null, 'A']);
    expect(rows[1]).toMatchObject({
      stops: 0,
      coded: 0,
      medianDelaySeconds: null,
    });
  });
});
