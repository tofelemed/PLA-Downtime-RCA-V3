import {
  ReconciliationDecisionParties,
  revisionSelfApproved,
  workflowActionSelfDecided,
} from './self-approval';

const parties: ReconciliationDecisionParties = {
  submittedBy: 'eng',
  revisionOpenedBy: null,
  lineAuthors: ['eng', null],
  bridgeReviewer: null,
};

describe('revisionSelfApproved (item 1.3)', () => {
  it('an independent approver is not a self-approval', () => {
    expect(revisionSelfApproved('mgr', parties)).toBe(false);
  });

  it('an unapproved revision is not a self-approval', () => {
    expect(revisionSelfApproved(null, parties)).toBe(false);
  });

  it('the submitter, a line author, the opener or the bridge reviewer approving is', () => {
    expect(revisionSelfApproved('eng', parties)).toBe(true);
    expect(
      revisionSelfApproved('sa', { ...parties, lineAuthors: ['sa'] }),
    ).toBe(true);
    expect(
      revisionSelfApproved('sa', { ...parties, revisionOpenedBy: 'sa' }),
    ).toBe(true);
    expect(
      revisionSelfApproved('sa', { ...parties, bridgeReviewer: 'sa' }),
    ).toBe(true);
  });
});

describe('workflowActionSelfDecided (item 1.3)', () => {
  it('a rejection is a self-decision only by the submitter', () => {
    expect(workflowActionSelfDecided('reject', 'eng', parties)).toBe(true);
    expect(
      workflowActionSelfDecided('reject', 'sa', {
        ...parties,
        lineAuthors: ['sa'],
      }),
    ).toBe(false);
  });

  it('a bridge review is one by the submitter, opener or a line author, never by itself', () => {
    expect(workflowActionSelfDecided('bridge_review', 'eng', parties)).toBe(
      true,
    );
    expect(
      workflowActionSelfDecided('bridge_review', 'rev', {
        ...parties,
        bridgeReviewer: 'rev',
      }),
    ).toBe(false);
  });

  it('an approval is one by any party including the bridge reviewer', () => {
    expect(
      workflowActionSelfDecided('approve', 'rev', {
        ...parties,
        bridgeReviewer: 'rev',
      }),
    ).toBe(true);
    expect(workflowActionSelfDecided('approve', 'mgr', parties)).toBe(false);
  });

  it('other actions and system actions are never self-decisions', () => {
    expect(workflowActionSelfDecided('submit', 'eng', parties)).toBe(false);
    expect(workflowActionSelfDecided('approve', null, parties)).toBe(false);
  });
});
