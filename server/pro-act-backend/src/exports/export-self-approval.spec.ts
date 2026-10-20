import { RenderSource, reviewedOf } from './export-report';
import { snapshotSelfApproved } from './export-self-approval';
import { sourceSection } from './pdf/pdf-content';

const reviewed = (authors: Array<string | null>) =>
  reviewedOf({
    reviewed: {
      utcStart: '2027-03-01T02:30:00.000Z',
      utcEnd: '2027-03-01T10:30:00.000Z',
      run: null,
      actuals: [],
      slices: [],
      candidates: [],
      lines: authors.map((authorId, i) => ({ id: `l${i}`, authorId })),
    },
  });

const NONE = { opener: null, bridgeReviewer: null };

describe('snapshotSelfApproved (item 1.3)', () => {
  it('an independent approver is not a self-approval', () => {
    const content = { submittedBy: 'eng', approvedBy: 'mgr' };
    expect(snapshotSelfApproved(content, reviewed(['eng']), NONE)).toBe(false);
  });

  it('the submitter approving the snapshot is a self-approval', () => {
    const content = { submittedBy: 'sa', approvedBy: 'sa' };
    expect(snapshotSelfApproved(content, reviewed([]), NONE)).toBe(true);
  });

  it('a line author, the opener or the bridge reviewer approving is a self-approval', () => {
    const content = { submittedBy: 'eng', approvedBy: 'sa' };
    expect(snapshotSelfApproved(content, reviewed([null, 'sa']), NONE)).toBe(
      true,
    );
    expect(
      snapshotSelfApproved(content, reviewed([]), { ...NONE, opener: 'sa' }),
    ).toBe(true);
    expect(
      snapshotSelfApproved(content, reviewed([]), {
        ...NONE,
        bridgeReviewer: 'sa',
      }),
    ).toBe(true);
  });

  it('a snapshot without approver or authors (older shape) is not a self-approval', () => {
    expect(snapshotSelfApproved({}, reviewed([null]), NONE)).toBe(false);
  });
});

describe('PDF section of a self-approved revision (item 1.3)', () => {
  const source = (selfApproved: boolean): RenderSource => ({
    periodId: 'period-1',
    unitId: 'unit-1',
    unitName: 'Reactor 1',
    revisionId: 'revision-1',
    revision: 2,
    snapshotId: 'snapshot-1',
    approvedAt: '2027-03-01T12:00:00.000Z',
    sliceProducts: {},
    reviewed: reviewed([]),
    selfApproved,
  });
  const factsOf = (selfApproved: boolean) =>
    sourceSection('period_summary', source(selfApproved), {
      plantName: 'Plant',
      timezone: 'UTC',
      calendar: 'gregorian',
      digits: 'latin',
      currency: 'USD',
    }).facts;

  it('says so in its facts; an independent approval does not', () => {
    expect(factsOf(true)).toContainEqual([
      'Approval',
      'Self-approved (SuperAdmin)',
    ]);
    expect(factsOf(false).map(([label]) => label)).not.toContain('Approval');
  });
});
