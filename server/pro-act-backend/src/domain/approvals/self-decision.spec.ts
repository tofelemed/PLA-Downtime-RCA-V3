import { isSelfDecision, versionSelfApproved } from './self-decision';

describe('isSelfDecision (item 1.3)', () => {
  it('is true when the decider is one of the parties', () => {
    expect(isSelfDecision('sa', ['author', 'sa'])).toBe(true);
  });

  it('is false for an independent decider, an undecided record or unknown parties', () => {
    expect(isSelfDecision('mgr', ['author'])).toBe(false);
    expect(isSelfDecision(null, [null])).toBe(false);
    expect(isSelfDecision(undefined, [undefined])).toBe(false);
    expect(isSelfDecision('mgr', [null, undefined])).toBe(false);
  });
});

describe('versionSelfApproved (item 1.3)', () => {
  it('a version approved by its author is self-approved', () => {
    expect(versionSelfApproved({ createdBy: 'sa', approvedBy: 'sa' })).toBe(
      true,
    );
  });

  it('a draft, a seeded version or an independent approval is not', () => {
    expect(versionSelfApproved({ createdBy: 'sa', approvedBy: null })).toBe(
      false,
    );
    expect(versionSelfApproved({ createdBy: null, approvedBy: 'mgr' })).toBe(
      false,
    );
    expect(versionSelfApproved({ createdBy: 'eng', approvedBy: 'mgr' })).toBe(
      false,
    );
  });
});
