import { approvalConflict } from './separation-of-duties';

const base = {
  submittedBy: 'engineer',
  revisionOpenedBy: null,
  lineAuthors: ['engineer'],
};

describe('approvalConflict (D06, RC-01)', () => {
  it('an independent approver may approve', () => {
    expect(approvalConflict('manager', base)).toBeNull();
  });

  it('the submitter may not approve', () => {
    expect(approvalConflict('engineer', base)).toBe('submitter');
  });

  it('an author of any line in the reviewed set may not approve', () => {
    expect(
      approvalConflict('manager', {
        ...base,
        lineAuthors: ['engineer', 'manager'],
      }),
    ).toBe('line_author');
  });

  it('whoever opened a revision of an approved period may not approve it', () => {
    expect(
      approvalConflict('manager', { ...base, revisionOpenedBy: 'manager' }),
    ).toBe('revision_opener');
  });

  it('lines without an author (system lines) never block', () => {
    expect(
      approvalConflict('manager', { ...base, lineAuthors: [null, 'engineer'] }),
    ).toBeNull();
  });
});
