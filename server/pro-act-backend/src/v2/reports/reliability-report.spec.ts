import { aggregateView, ReliabilityRowView } from './kpi-reports-v2.view';
import { reliabilityNotes } from './reliability-report';
import { Dec } from '../../domain/actuals/decimal';
import { GroupTerms } from '../../domain/kpi/aggregate';

function terms(seconds: number | null): GroupTerms | undefined {
  return seconds === null
    ? undefined
    : {
        numerator: new Dec(seconds),
        denominator: new Dec(1),
        minValue: null,
        rows: 1,
        complete: 1,
        provisionalRows: 0,
        policies: 1,
        reasons: [],
      };
}

function row(mttr: number | null): ReliabilityRowView {
  return {
    unitId: 'u1',
    assetId: null,
    label: null,
    exposureSeconds: null,
    failures: null,
    mtbf: aggregateView('mtbf', undefined),
    meanDowntimeToRestore: aggregateView(
      'mean_downtime_to_restore',
      terms(3600),
    ),
    mttr: aggregateView('mttr', terms(mttr)),
  };
}

const view = (
  units: ReliabilityRowView[],
  assets: ReliabilityRowView[] = [],
) => ({
  units,
  assets,
  failureDefinition: '',
  calculationRunIds: [],
});

describe('reliabilityNotes (Marun E2E 1.5)', () => {
  it('states the MTTR note while a row has no active-repair evidence', () => {
    expect(reliabilityNotes(view([row(1800)], [row(null)]))).toHaveLength(1);
  });

  it('drops the note once every unit and asset has MTTR', () => {
    expect(reliabilityNotes(view([row(1800)], [row(1800)]))).toEqual([]);
  });
});
