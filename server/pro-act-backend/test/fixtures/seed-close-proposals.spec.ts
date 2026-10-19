import { dismissUnchangedCloseProposals } from '../../scripts/demo-showcase/seed-close-proposals';
import { PersonaSession } from '../../scripts/demo-showcase/showcase-client';
import { Tally } from '../../scripts/demo-showcase/showcase-context';
import type { OpenProposal } from '../../src/close/month-prerequisites';
import type { ChangeProposalV2View } from '../../src/v2/reconciliation/reconciliation-v2.view';

function fixture() {
  const manager = new PersonaSession('reviewer', '', '', 'tenant', 'seed');
  manager.userId = 'independent-manager';
  const before = {
    inputHash: 'approved-hash',
    slices: [{ sliceId: 'slice', target: '100', residual: '0' }],
    ledgers: [{ ledger: 'plan', target: '100', actual: '90', flags: [] }],
  };
  const proposal: ChangeProposalV2View = {
    id: 'proposal',
    periodId: 'period',
    unitId: 'unit',
    approvedRevisionId: 'approved',
    trigger: 'event_change',
    state: 'open',
    inputHash: 'changed-metadata-hash',
    before,
    after: {
      ...(JSON.parse(JSON.stringify(before)) as typeof before),
      inputHash: 'changed-metadata-hash',
      issues: [],
    },
    detail: { reason: 'loss_event_changed' },
    manual: null,
    valueAfter: null,
    affectedReports: [],
    resolvedBy: null,
    resolvedAt: null,
    resolutionReason: null,
    createdRevisionId: null,
    createdAt: '',
    updatedAt: '',
    rowVersion: 1,
  };
  const brief: OpenProposal = {
    proposalId: proposal.id,
    periodId: proposal.periodId,
    unitId: proposal.unitId,
    localDate: '2026-08-30',
    trigger: proposal.trigger,
    planId: 'plan',
    manualReason: null,
    createdAt: '',
  };
  const get = jest.spyOn(manager, 'get').mockResolvedValue(proposal);
  const post = jest.spyOn(manager, 'post').mockImplementation((path, body) =>
    Promise.resolve({
      proposal: {
        ...proposal,
        state: 'dismissed',
        resolvedBy: manager.userId,
        resolutionReason: (body as { reason: string }).reason,
      },
      revision: null,
    }),
  );
  const ctx = { as: jest.fn(() => manager), tally: new Tally() };
  const month = {
    monthKey: '1405-06',
    state: 'open',
    prerequisites: { openProposalCount: 1, openProposals: [brief] },
  };
  return { ctx, month, proposal, get, post };
}

describe('seed-only unchanged close proposal review', () => {
  it('independently dismisses an automatic unchanged preview with an explicit reason', async () => {
    const f = fixture();
    await dismissUnchangedCloseProposals(f.ctx, f.month);
    expect(f.ctx.as).toHaveBeenCalledWith('managers', 1);
    expect(f.get).toHaveBeenCalledWith('/v2/period-change-proposals/proposal');
    expect(f.post).toHaveBeenCalledWith(
      '/v2/period-change-proposals/proposal/dismiss',
      { reason: expect.stringContaining('exactly unchanged') as unknown },
      'dismiss unchanged automatic event proposal proposal',
    );
  });

  it.each<[string, (p: ChangeProposalV2View) => void]>([
    [
      'manual trigger',
      (p) => {
        p.trigger = 'manual_correction';
      },
    ],
    [
      'retained manual detail',
      (p) => {
        p.detail.manual = { reason: 'late evidence' };
      },
    ],
    [
      'changed slices',
      (p) => {
        p.after!.slices = [{ target: '101' }];
      },
    ],
    [
      'changed ledgers',
      (p) => {
        p.after!.ledgers = [{ target: '101' }];
      },
    ],
    [
      'preview issues',
      (p) => {
        p.after!.issues = ['missing actuals'];
      },
    ],
    [
      'missing preview',
      (p) => {
        p.after = null;
      },
    ],
    [
      'missing slice evidence',
      (p) => {
        delete p.before.slices;
        delete p.after!.slices;
      },
    ],
    [
      'empty ledger evidence',
      (p) => {
        p.before.ledgers = [];
        p.after!.ledgers = [];
      },
    ],
    [
      'missing issues',
      (p) => {
        delete p.after!.issues;
      },
    ],
    [
      'different period',
      (p) => {
        p.periodId = 'other-period';
      },
    ],
    [
      'already resolved',
      (p) => {
        p.state = 'dismissed';
      },
    ],
  ])('refuses %s without a write', async (_name, change) => {
    const f = fixture();
    change(f.proposal);
    await expect(
      dismissUnchangedCloseProposals(f.ctx, f.month),
    ).rejects.toThrow('review it manually');
    expect(f.post).not.toHaveBeenCalled();
  });

  it('does not inspect or dismiss the deliberate proposal when the month is locked', async () => {
    const f = fixture();
    f.month.state = 'locked';
    f.proposal.trigger = 'manual_correction';
    await dismissUnchangedCloseProposals(f.ctx, f.month);
    expect(f.get).not.toHaveBeenCalled();
    expect(f.post).not.toHaveBeenCalled();
  });

  it('rejects a capped/incomplete prerequisite list before requests', async () => {
    const f = fixture();
    f.month.prerequisites.openProposalCount = 51;
    await expect(
      dismissUnchangedCloseProposals(f.ctx, f.month),
    ).rejects.toThrow('incomplete');
    expect(f.get).not.toHaveBeenCalled();
    expect(f.post).not.toHaveBeenCalled();
  });

  it('reviews every proposal before any dismissal', async () => {
    const f = fixture();
    f.month.prerequisites.openProposalCount = 2;
    f.month.prerequisites.openProposals.push({
      ...f.month.prerequisites.openProposals[0],
      proposalId: 'second',
    });
    f.get
      .mockResolvedValueOnce(f.proposal)
      .mockResolvedValueOnce({ ...f.proposal, id: 'second', after: null });
    await expect(
      dismissUnchangedCloseProposals(f.ctx, f.month),
    ).rejects.toThrow('review it manually');
    expect(f.get).toHaveBeenCalledTimes(2);
    expect(f.post).not.toHaveBeenCalled();
  });

  it('fails if dismissal response does not record the reviewing manager', async () => {
    const f = fixture();
    f.post.mockResolvedValue({
      proposal: { ...f.proposal, state: 'dismissed' },
      revision: null,
    });
    await expect(
      dismissUnchangedCloseProposals(f.ctx, f.month),
    ).rejects.toThrow('readback did not match');
  });
});
