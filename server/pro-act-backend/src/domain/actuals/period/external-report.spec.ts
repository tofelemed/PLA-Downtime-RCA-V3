import {
  compareRevisions,
  draftProblems,
  ExternalReportDraft,
  isReleasedStatus,
  reportsFromCsv,
} from './external-report';
import { externalLineCandidate } from './external-line-candidate';

const unit = '11111111-1111-4111-8111-111111111111';
const product = '22222222-2222-4222-8222-222222222222';
const day = {
  from: new Date('2027-03-01T02:30:00Z'),
  to: new Date('2027-03-02T02:30:00Z'),
};

const draft = (
  overrides: Partial<ExternalReportDraft> = {},
): ExternalReportDraft => ({
  externalReportId: 'MX-1',
  externalRevision: '1',
  siteId: null,
  localProductionDate: '2027-03-01',
  timezone: null,
  utcStart: day.from,
  utcEnd: day.to,
  basis: 'gross',
  sourceStatus: 'COMPLETED',
  approvedAtSource: null,
  evidenceRef: null,
  lines: [
    {
      unitId: unit,
      productId: product,
      gross: '1200',
      good: null,
      reject: '20',
      uom: 't',
    },
  ],
  ...overrides,
});

describe('external daily-production records (ACT08)', () => {
  it('SME R13: only a status the source mapping releases is certified-eligible (case-insensitive)', () => {
    const lims = [
      { status: 'COMPLETED', released: false },
      { status: 'AUTHORIZED', released: true },
    ];
    expect(isReleasedStatus('authorized', lims)).toBe(true);
    expect(isReleasedStatus('COMPLETED', lims)).toBe(false);
    expect(isReleasedStatus('RELEASED', lims)).toBe(false);
    expect(isReleasedStatus('AUTHORIZED', null)).toBe(false);
  });

  it('orders numeric revisions; non-numeric ones are left to import order', () => {
    expect(compareRevisions('2', '10')).toBeLessThan(0);
    expect(compareRevisions('b', 'a')).toBeNull();
  });

  it('validates the basis quantity, duplicates and negative values', () => {
    expect(draftProblems(draft())).toEqual([]);
    const bad = draft({
      basis: 'good',
      lines: [
        {
          unitId: unit,
          productId: product,
          gross: '-1',
          good: null,
          reject: null,
          uom: 't',
        },
        {
          unitId: unit,
          productId: product,
          gross: '1',
          good: '1',
          reject: null,
          uom: 't',
        },
      ],
    });
    expect(draftProblems(bad)).toEqual([
      'lines[0].good is required by the basis',
      'lines[0].gross must be a non-negative decimal',
      'lines[1] repeats unit and product',
    ]);
  });

  it('reads CSV rows into one record per report id + revision', () => {
    const csv =
      'externalReportId,externalRevision,localProductionDate,utcStart,utcEnd,basis,sourceStatus,unitId,productId,gross\n' +
      `MX-1,1,2027-03-01,2027-03-01T02:30:00Z,2027-03-02T02:30:00Z,gross,COMPLETED,${unit},${product},10\n` +
      `MX-1,1,2027-03-01,2027-03-01T02:30:00Z,2027-03-02T02:30:00Z,gross,COMPLETED,${unit},${unit},5\n` +
      'MX-2,1,2027-03-01,bad,2027-03-02T02:30:00Z,gross,COMPLETED,x,y,1\n';
    const { reports, problems } = reportsFromCsv(csv);
    expect(reports).toHaveLength(1);
    expect(reports[0].lines).toHaveLength(2);
    expect(problems).toEqual([
      { line: 4, message: 'invalid time or basis (gross | good)' },
    ]);
  });

  it('a record applies only to a period of exactly its window; only-good gives gross unknown', () => {
    const line = {
      reportId: 'r1',
      externalReportId: 'MX-1',
      externalRevision: '1',
      window: day,
      basis: 'good' as const,
      gross: null,
      good: '900',
      reject: null,
      uom: 't',
    };
    const daily = externalLineCandidate(line, day);
    expect(daily.basis).toBe('good');
    expect(daily.quantity?.toString()).toBe('900');
    const shift = externalLineCandidate(line, {
      from: day.from,
      to: new Date('2027-03-01T10:30:00Z'),
    });
    expect(shift.quantity).toBeNull();
    expect(shift.findings[0].code).toBe('external_report_grain_mismatch');
  });
});
