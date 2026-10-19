import { singleView, SNAPSHOT_VIEW_SOURCE } from './approved-snapshot-view';
import { approvedImpactBasis } from './approved-impact';
import { itemChanges, itemChangesOf } from './audit-item-changes';
import { baselinePolicyVersion } from './baseline-policy-version';
import { publicBasis, publicEvidence } from './evidence-basis-text';
import { changedFields } from './rca-audit';
import { historyReason } from './repair-reasons';
import { RcaAction } from '../rca/entities/rca-action.entity';

const OLD_BASIS =
  'Approved plan lines of the latest approved revision of each period (decided quantities, loss kinds only); ' +
  'economic impact view (lost contribution on unrecovered sales + incremental costs) (the policy default, SME V8); ' +
  'draft and in-review figures are never included';

describe('RCA QA re-test round 3 (server)', () => {
  describe('M3: one basis for the approved figure', () => {
    it('uses the view frozen in the approval snapshots when they agree', () => {
      expect(
        singleView(['contribution_margin', 'contribution_margin', null]),
      ).toBe('contribution_margin');
      expect(
        singleView(['contribution_margin', 'economic_impact']),
      ).toBeUndefined();
      expect(singleView([null])).toBeUndefined();
      expect(singleView(['unknown_view'])).toBeUndefined();
      expect(
        approvedImpactBasis('contribution_margin', SNAPSHOT_VIEW_SOURCE),
      ).toContain(
        'valued in the contribution margin view (the view frozen when the periods were approved)',
      );
    });

    it('drops the internal reference and the policy-default claim from frozen package bases', () => {
      const text = publicBasis(OLD_BASIS);
      expect(text).not.toMatch(/SME|policy default/);
      expect(text).toContain('incremental costs); draft and in-review');
      const evidence = {
        kind: 'event',
        approvedImpact: { lines: 1, view: 'economic_impact', basis: OLD_BASIS },
      };
      const shown = publicEvidence(evidence);
      expect((shown?.approvedImpact as { basis: string }).basis).not.toContain(
        'SME V8',
      );
      expect(evidence.approvedImpact.basis).toBe(OLD_BASIS);
      expect(publicEvidence(null)).toBeNull();
      expect(publicEvidence({ kind: 'event' })).toEqual({ kind: 'event' });
    });
  });

  describe('L8: History names the evidence item that changed', () => {
    const before = JSON.stringify([
      { id: 'e1', title: 'Oil sample', taskStatus: 'pending', verified: false },
      { id: 'e2', title: 'Old photo' },
    ]);
    const after = JSON.stringify([
      {
        id: 'e1',
        title: 'Oil sample',
        taskStatus: 'completed',
        verified: true,
      },
      { id: 'e3', title: 'Thermography' },
    ]);

    it('lists added, edited and removed items with the edited fields, never ids or values', () => {
      expect(itemChanges(before, after)).toEqual([
        {
          item: 'Oil sample',
          change: 'edited',
          fields: ['taskStatus', 'verified'],
        },
        { item: 'Thermography', change: 'added', fields: [] },
        { item: 'Old photo', change: 'removed', fields: [] },
      ]);
    });

    it('records item changes only for list fields of items with ids', () => {
      const from = { evidence: before, title: 'A' };
      const to = { evidence: after, title: 'B' };
      const result = itemChangesOf(changedFields(from, to), from, to);
      expect(Object.keys(result ?? {})).toEqual(['evidence']);
      expect(itemChanges('not json', '[]')).toBeNull();
      expect(itemChanges(before, before)).toBeNull();
    });
  });

  describe('N4: the repair reason in the History', () => {
    it('shows the known repair in the screens’ words, without the "Data repair:" prefix', () => {
      const reason = historyReason({
        action: 'rca_case.repaired',
        reason:
          'Data repair: the recommendations … were set to Completed or Cancelled',
        detail: { repair: 'CloseRecommendationsOfClosedCases1794221700000' },
      });
      expect(reason).toMatch(
        /^Recommendations completed after the investigation closed/,
      );
      expect(reason).toContain('Done or Cancelled');
      expect(reason).not.toMatch(/Data repair|Completed/);
    });

    it('strips the prefix of other repairs and leaves other entries as stored', () => {
      expect(
        historyReason({
          action: 'rca_case.repaired',
          reason: 'Data repair: fixed units',
          detail: {},
        }),
      ).toBe('Fixed units');
      expect(
        historyReason({
          action: 'rca_case.updated',
          reason: 'Data repair: kept',
          detail: {},
        }),
      ).toBe('Data repair: kept');
    });
  });

  describe('L11: the policy version of a baseline', () => {
    const withCriteria = (policyVersion?: number) =>
      ({
        baseline: {
          computedAt: '2026-10-17T10:00:00.000Z',
          criteria: {
            requiredReduction: 0.5,
            minExposureHours: 720,
            ...(policyVersion ? { policyVersion } : {}),
          },
        },
      }) as unknown as RcaAction;

    it('prefers the frozen version, else the one in force when the baseline was computed', () => {
      const at = new Map([['2026-10-17T10:00:00.000Z', 1]]);
      expect(baselinePolicyVersion(withCriteria(3), at)).toBe(3);
      expect(baselinePolicyVersion(withCriteria(), at)).toBe(1);
      expect(baselinePolicyVersion(withCriteria(), new Map())).toBeNull();
      expect(baselinePolicyVersion({ baseline: null }, at)).toBeNull();
    });
  });
});
