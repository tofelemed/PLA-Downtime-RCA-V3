import { ExposureWindow } from './effectiveness';
import { ActionBaseline } from './rca-verification';
import {
  recurrenceWatchOf,
  RECURRENCE_WATCH_DAYS,
  RECURRENCE_WATCH_VERSION,
  watchBaselineOf,
  WatchedAction,
  watchWindowOf,
} from './recurrence-watch';

const HOURS = (n: number) => String(n * 3600);
const window = (
  incidents: number,
  hours: number,
  basis: ExposureWindow['exposureBasis'] = 'unit_run_time',
): ExposureWindow => ({
  from: '2027-01-01T00:00:00.000Z',
  to: '2027-04-01T00:00:00.000Z',
  incidents,
  downtimeSeconds: '0',
  exposureSeconds: HOURS(hours),
  exposureBasis: basis,
});
const baseline = (
  incidents: number,
  hours: number,
  extra: Partial<ActionBaseline> = {},
): ActionBaseline => ({
  metric: 'recurrences',
  windowDays: 90,
  value: String(incidents),
  declared: false,
  window: window(incidents, hours),
  criteria: {
    requiredReduction: 0.5,
    minExposureHours: 720,
    zeroRepeat: false,
  },
  ...extra,
});
const action = (
  id: string,
  base: ActionBaseline | null,
  extra: Partial<WatchedAction> = {},
): WatchedAction => ({
  id,
  status: 'done',
  baseline: base,
  verdict: 'effective',
  ...extra,
});

describe('watchBaselineOf (D-T3 frozen baseline)', () => {
  it('takes the pre-action rate of a verified action: 5 in 1,000 run hours = 5 per 1,000 h', () => {
    const found = watchBaselineOf([action('a', baseline(5, 1000))]);
    expect(found?.actionId).toBe('a');
    expect(found?.rate.toString()).toBe('5');
    expect(found?.minExposureHours).toBe(720);
  });

  it('with several verified actions the highest baseline rate is used', () => {
    const found = watchBaselineOf([
      action('low', baseline(2, 1000)),
      action('high', baseline(6, 1000)),
    ]);
    expect(found?.actionId).toBe('high');
  });

  it('skips cancelled, unverified and pre-CA3 actions; none left = not watched', () => {
    expect(
      watchBaselineOf([
        action('c', baseline(5, 1000), { status: 'cancelled' }),
        action('u', baseline(5, 1000), { verdict: null }),
        action('d', { ...baseline(5, 1000), window: undefined }),
        action('n', null),
      ]),
    ).toBeNull();
  });

  it('an approved correction replaces the counted incidents (CA3)', () => {
    const corrected = baseline(4, 800, {
      correction: {
        value: '3',
        reason: 'one stop was a planned test',
        status: 'approved',
        proposedBy: 'u1',
        proposedAt: '2027-01-01T00:00:00Z',
        decidedBy: 'u2',
        decidedAt: '2027-01-02T00:00:00Z',
        note: null,
      },
    });
    expect(watchBaselineOf([action('a', corrected)])?.rate.toString()).toBe(
      '3.75',
    );
  });

  it('keeps the standby exposure basis frozen with the baseline (CA4)', () => {
    const standby = baseline(3, 500, {
      window: window(3, 500, 'standby_running_time'),
    });
    expect(watchBaselineOf([action('s', standby)])?.exposureBasis).toBe(
      'standby_running_time',
    );
  });
});

describe('watchWindowOf (180 days after closure)', () => {
  const closedAt = new Date('2027-05-01T00:00:00Z');

  it('runs from the closure to now inside the watch', () => {
    const now = new Date('2027-06-01T00:00:00Z');
    expect(watchWindowOf(closedAt, now)).toEqual({ from: closedAt, to: now });
  });

  it('stops 180 days after the closure', () => {
    const end = new Date(
      closedAt.getTime() + RECURRENCE_WATCH_DAYS * 86_400_000,
    );
    expect(watchWindowOf(closedAt, end)).toBeNull();
    expect(
      watchWindowOf(closedAt, new Date(end.getTime() - 3_600_000)),
    ).not.toBeNull();
  });
});

describe('recurrenceWatchOf (D-T3 threshold and short-exposure guard)', () => {
  const frozen = watchBaselineOf([action('a', baseline(5, 1000))])!;

  it('fires when the rate since closure exceeds the baseline: 8 in 1,000 h > 5', () => {
    const result = recurrenceWatchOf({
      baseline: frozen,
      observed: window(8, 1000),
    });
    expect(result).toMatchObject({
      version: RECURRENCE_WATCH_VERSION,
      fires: true,
      observedRate: '8',
      guardedRate: '8',
      baselineRate: '5',
      baselineActionId: 'a',
    });
  });

  it('does not fire at or below the baseline: 5 in 1,000 h', () => {
    expect(
      recurrenceWatchOf({ baseline: frozen, observed: window(5, 1000) }).fires,
    ).toBe(false);
  });

  it('one incident in 10 run hours is counted over the 720 h minimum, not as 100 per 1,000 h', () => {
    const result = recurrenceWatchOf({
      baseline: frozen,
      observed: window(1, 10),
    });
    expect(result.observedRate).toBe('100');
    expect(result.guardedRate).toBe('1.3889');
    expect(result.fires).toBe(false);
  });

  it('a burst still fires before the minimum exposure: 4 incidents in 100 h = 5.6 per 1,000 h over 720 h', () => {
    const result = recurrenceWatchOf({
      baseline: frozen,
      observed: window(4, 100),
    });
    expect(result.guardedRate).toBe('5.5556');
    expect(result.fires).toBe(true);
  });

  it('no incident never fires, also without exposure', () => {
    const result = recurrenceWatchOf({
      baseline: frozen,
      observed: window(0, 0),
    });
    expect(result.fires).toBe(false);
    expect(result.observedRate).toBeNull();
  });
});
