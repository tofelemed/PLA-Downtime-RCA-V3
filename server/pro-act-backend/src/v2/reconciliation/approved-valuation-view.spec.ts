import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import {
  approvedValuationViewOf,
  loadApprovedValuation,
} from './approved-valuation-view';

const revision = (lifecycle: AccountingRevision['lifecycle']) =>
  Object.assign(new AccountingRevision(), {
    id: 'rev-2',
    tenantId: 'plant',
    lifecycle,
  });

/** A manager whose SQL answers are the snapshot row, then the current policy row. */
function managerOf(
  snapshot: Record<string, unknown> | null,
  policy: Record<string, unknown> | null,
) {
  const query = jest
    .fn<Promise<unknown[]>, [string, unknown[]]>()
    .mockResolvedValueOnce(snapshot ? [snapshot] : [])
    .mockResolvedValueOnce(policy ? [policy] : []);
  return { manager: { query } as unknown as EntityManager, query };
}

const FROZEN_ROW = {
  view: 'contribution_margin',
  policy_id: 'pol-1',
  policy_version: '1',
};

describe('approved revision valuation view (owner, 18 Oct 2026)', () => {
  it('keeps the view frozen at approval and flags a current policy that opens on another view', async () => {
    const { manager, query } = managerOf(FROZEN_ROW, {
      id: 'pol-3',
      version: 3,
      basis: 'economic_impact',
    });
    const view = await loadApprovedValuation(
      manager,
      revision('approved'),
      'proposal-9',
    );
    expect(view).toEqual({
      view: 'contribution_margin',
      policyId: 'pol-1',
      policyVersion: 1,
      current: { view: 'economic_impact', policyId: 'pol-3', policyVersion: 3 },
      differs: true,
      restatementProposalId: 'proposal-9',
    });
    expect(query.mock.calls[0][1]).toEqual(['rev-2', 'plant']);
    expect(query.mock.calls[1][1]).toEqual(['plant']);
  });

  it('no difference when the current policy opens on the frozen view; no proposal = none opened', () => {
    const frozen = {
      view: 'economic_impact',
      policyId: 'pol-3',
      policyVersion: 3,
    };
    expect(approvedValuationViewOf(frozen, frozen, null)).toMatchObject({
      differs: false,
      restatementProposalId: null,
    });
  });

  it('without an approved policy the current view is contribution margin with no version', async () => {
    const { manager } = managerOf(
      { ...FROZEN_ROW, view: 'standard_cost' },
      null,
    );
    const view = await loadApprovedValuation(
      manager,
      revision('approved'),
      null,
    );
    expect(view?.current).toEqual({
      view: 'contribution_margin',
      policyId: null,
      policyVersion: null,
    });
    expect(view?.differs).toBe(true);
  });

  it('draft and in-review revisions, and snapshots without a valuation, carry none', async () => {
    for (const lifecycle of ['draft', 'in_review'] as const) {
      const { manager, query } = managerOf(FROZEN_ROW, null);
      expect(
        await loadApprovedValuation(manager, revision(lifecycle), null),
      ).toBeNull();
      expect(query).not.toHaveBeenCalled();
    }
    const { manager } = managerOf(
      { view: null, policy_id: null, policy_version: null },
      null,
    );
    expect(
      await loadApprovedValuation(manager, revision('approved'), null),
    ).toBeNull();
  });
});
