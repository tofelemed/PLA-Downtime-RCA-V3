import { LossEvent } from '../domain/accounting/accounting.types';
import { EnginePolicies } from '../periods/accounting-policies.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { LoadedValuation } from '../valuation/valuation-context.loader';
import { AccountingInputs } from './accounting-inputs.loader';
import { hashOf } from './run-input-hash';

const start = new Date('2027-03-03T02:30:00Z');
const end = new Date('2027-03-03T10:30:00Z');

const stop: LossEvent = {
  eventId: 'e1',
  revisionId: null,
  revision: null,
  occurrenceId: 'o1',
  physicalType: 'downtime',
  start,
  end: new Date(start.getTime() + 90_000),
  scheduleClass: 'unplanned',
  oeeComponent: 'availability',
  impactMode: 'full_stop',
  impactFraction: null,
  quantity: null,
  reasonCodeId: 'rc-1',
  impactCodeId: null,
  failureMode: null,
  assetId: 'a1',
  assetClass: 'Bagger',
  reasonCode: 'JAM',
};

function inputs(
  event: LossEvent,
  standby: AccountingInputs['kpi']['standby'] = [],
): AccountingInputs {
  return {
    schedule: [],
    events: [event],
    slices: [],
    asOf: end,
    transitionStandards: [],
    fingerprint: {
      periodId: 'p1',
      window: { start: start.toISOString(), end: end.toISOString() },
      sliceIds: [],
      eventRevisions: [{ eventId: 'e1', revisionId: null, rowVersion: 1 }],
      occurrenceIds: ['o1'],
      actualsRunId: null,
      planVersionId: null,
      planPeriodIds: [],
      rateVersionIds: [],
      calendarVersionIds: [],
      transitionStandardIds: [],
      asOf: null,
    },
    kpi: { occurrences: [], failures: [], stateTimeline: null, standby },
  };
}

const period = {
  isExcluded: false,
  exclusionKind: null,
} as unknown as ProductionPeriod;
const policies = {
  engine: { refs: [] } as unknown as EnginePolicies,
  valuation: { context: null } as unknown as LoadedValuation,
};
const hash = (value: AccountingInputs) => hashOf(period, value, policies);

describe('run input hash: master data read through event ids', () => {
  const before = hash(inputs(stop));

  it('is stable for the same inputs', () => {
    expect(hash(inputs({ ...stop }))).toBe(before);
  });

  it('re-typing the asset changes it (micro-stop threshold per asset class, SME D6)', () => {
    expect(hash(inputs({ ...stop, assetClass: 'Conveyor' }))).not.toBe(before);
  });

  it('recoding the reason changes it (trip reasons, SME D6)', () => {
    expect(hash(inputs({ ...stop, reasonCode: 'ELEC-MTR' }))).not.toBe(before);
  });

  it('standby runs change it (MTBF exposure of a standby asset, SME D9)', () => {
    const runs = [{ assetId: 'a2', runs: [{ start, end }] }];
    expect(hash(inputs(stop, runs))).not.toBe(before);
  });
});
