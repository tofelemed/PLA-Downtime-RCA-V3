import {
  EnginePolicy,
  LossEvent,
  PeriodAccountingInput,
} from './accounting.types';
import { microStopThresholdOf } from './micro-stop-threshold';
import { classifyEvents } from './segmentation';

const at = (s: number) => new Date(Date.UTC(2026, 9, 14, 8, 0, s));

const stop = (
  id: string,
  seconds: number,
  extra: Partial<LossEvent> = {},
): LossEvent => ({
  eventId: id,
  revisionId: null,
  revision: null,
  occurrenceId: id,
  physicalType: 'downtime',
  start: at(0),
  end: at(seconds),
  scheduleClass: 'unplanned',
  oeeComponent: 'availability',
  impactMode: 'full_stop',
  impactFraction: null,
  quantity: null,
  reasonCodeId: null,
  impactCodeId: null,
  failureMode: null,
  ...extra,
});

/** SME D6 pilot: unit 60 s, bagger / conveyor 120 s, reactor 0 (every trip is an event). */
const POLICY: EnginePolicy = {
  microStopSeconds: 60,
  microStopSecondsByAssetClass: { Bagger: 120, conveyor: 120, Reactor: 0 },
  tripReasonCodes: ['PROC-TRIP'],
  derateComponent: 'performance',
  plannedStopsInsideScheduleReduceAvailability: true,
  epsilon: '0.000001',
};

describe('micro-stop threshold per asset class (SME D6)', () => {
  it('uses the asset class threshold, the unit threshold otherwise', () => {
    expect(
      microStopThresholdOf([stop('a', 90, { assetClass: 'bagger' })], POLICY),
    ).toBe(120);
    expect(
      microStopThresholdOf([stop('a', 90, { assetClass: 'Extruder' })], POLICY),
    ).toBe(60);
    expect(microStopThresholdOf([stop('a', 90)], POLICY)).toBe(60);
    expect(
      microStopThresholdOf([stop('a', 10, { assetClass: 'Reactor' })], POLICY),
    ).toBe(0);
  });

  it('a process trip or a functional failure is never a micro-stop', () => {
    expect(
      microStopThresholdOf(
        [stop('a', 30, { assetClass: 'Bagger', reasonCode: 'proc-trip' })],
        POLICY,
      ),
    ).toBe(0);
    expect(
      microStopThresholdOf(
        [stop('a', 30, { assetClass: 'Bagger', failureSeverity: 'critical' })],
        POLICY,
      ),
    ).toBe(0);
    expect(
      microStopThresholdOf(
        [stop('a', 30, { assetClass: 'Bagger', failureSeverity: 'incipient' })],
        POLICY,
      ),
    ).toBe(120);
  });

  it('a version without the options keeps the unit threshold for every stop', () => {
    const plain: EnginePolicy = {
      ...POLICY,
      microStopSecondsByAssetClass: undefined,
      tripReasonCodes: undefined,
    };
    expect(
      microStopThresholdOf([stop('a', 30, { assetClass: 'Bagger' })], plain),
    ).toBe(60);
  });

  it('ten 30 s bagger stops stay performance loss; a 90 s bagger stop too; a 90 s extruder stop is availability', () => {
    const input: PeriodAccountingInput = {
      window: { start: at(0), end: new Date(Date.UTC(2026, 9, 14, 16)) },
      periodExcluded: false,
      periodExclusionKind: null,
      schedule: [],
      events: [
        stop('bag30', 30, { assetClass: 'Bagger' }),
        stop('bag90', 90, { assetClass: 'Bagger' }),
        stop('ext90', 90, { assetClass: 'Extruder' }),
        stop('trip30', 30, { assetClass: 'Bagger', reasonCode: 'PROC-TRIP' }),
      ],
      slices: [],
      asOf: new Date(Date.UTC(2026, 9, 14, 16)),
      policy: POLICY,
    };
    const classified = classifyEvents(input);
    expect(classified.microStops.map((e) => e.eventId)).toEqual([
      'bag30',
      'bag90',
    ]);
    expect(classified.stops.map((e) => e.eventId)).toEqual(['ext90', 'trip30']);
  });
});
