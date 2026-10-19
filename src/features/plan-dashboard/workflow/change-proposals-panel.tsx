import { Badge } from '@/components/ui/badge';
import { useChangeProposals } from '@/api/v2/queries/period-overview';
import { useProposalDecision, useProposeCorrection } from '@/api/v2/queries/period-workflow';
import type { ChangeProposalView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { EditorProblem } from '../editor/editor-problem';
import { useCommandProblem } from '../hooks/use-command-problem';
import { periodRefOf } from '../hooks/use-draft-editor';
import { proposalTriggersText } from '../model/proposal-labels';
import { EVIDENCE_LABELS } from '../model/line-evidence';
import { ProposeCorrectionDialog, type CorrectionDraft } from './propose-correction-dialog';
import { ProposalCodingChanges } from './proposal-coding-changes';
import { ProposalComparison } from './proposal-comparison';
import { ProposalValues } from './proposal-values';
import { ReasonConfirm } from './reason-confirm';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { pageListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';
import { plural } from '@/features/ux-kit/format/plural';

export interface ChangeProposalsPanelProps {
  view: ReconciliationView;
  timezone: string;
}

const STATE_LABELS: Readonly<Record<string, string>> = { open: 'Open', accepted: 'Accepted', dismissed: 'Dismissed', superseded: 'Superseded' };

function ManualDetail({ p }: { p: ChangeProposalView }) {
  if (!p.manual) return null;
  return (
    <div className="text-xs" data-testid="manual-proposal">
      <p>{p.manual.reason}</p>
      <p className="text-muted-foreground">
        Evidence: {EVIDENCE_LABELS[p.manual.evidenceType] ?? p.manual.evidenceType} · {p.manual.evidenceRef}
      </p>
    </div>
  );
}

/** One change proposal with its before / after and, for an approver who may decide it, accept / dismiss. */
export function ChangeProposalCard({ p, timezone, decide }: { p: ChangeProposalView; timezone: string; decide: ((p: ChangeProposalView, d: 'accept' | 'dismiss', reason: string) => Promise<unknown>) | null }) {
  const { number } = useNumberFormat();
  return (
    <div id={`change-proposal-${p.id}`} className="scroll-mt-24 space-y-1 rounded-md border p-2" data-testid="change-proposal" data-state={p.state} data-highlight-label="the change proposal">
      <p>
        <Badge variant={p.state === 'open' ? 'destructive' : 'secondary'}>{labelOf(STATE_LABELS, p.state)}</Badge> <span data-testid="proposal-triggers">{proposalTriggersText(p)}</span> · <PlantTime iso={p.createdAt} tz={timezone} withDate />
      </p>
      <ManualDetail p={p} />
      <ProposalValues p={p} />
      <ProposalCodingChanges p={p} />
      <ProposalComparison p={p} />
      {p.affectedReports.length > 0 && <p className="text-xs">Affects {plural(p.affectedReports.length, 'earlier export', 'earlier exports', number)} of the approved figures.</p>}
      {p.state === 'open' && !decide && p.manual && <p className="text-xs text-muted-foreground">Waiting for another approver to decide.</p>}
      {p.state === 'open' && decide && (
        <div className="flex flex-wrap gap-2">
          <ReasonConfirm trigger="Accept (new revision)…" triggerTestId="proposal-accept" triggerVariant="default" title="Accept this change?" description="A new draft revision is opened with the new inputs; the approved figures stay until it is approved." confirmLabel="Accept change" onConfirm={(reason) => decide(p, 'accept', reason)} />
          <ReasonConfirm trigger="Dismiss…" triggerTestId="proposal-dismiss" title="Dismiss this change?" description="The approved figures stay as they are." confirmLabel="Dismiss change" onConfirm={(reason) => decide(p, 'dismiss', reason)} />
        </div>
      )}
    </div>
  );
}

/**
 * Late corrections of an approved period: before / after from the server; accept opens a revision,
 * dismiss keeps the approval. Revision approvers decide — never the proposer of a manual correction (SME R4),
 * so the proposer does not see the decision controls. Production accounting and plant management propose a
 * correction of a closing or locked month's period; the server refuses one for an open month (MONTH_OPEN).
 */
export function ChangeProposalsPanel({ view, timezone }: ChangeProposalsPanelProps) {
  const { canApproveRevisions, canProposeCorrections, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const anchor = useAnchorFocus('change-proposal-');
  const proposals = useChangeProposals(view.periodId, anchor.focus);
  const decision = useProposalDecision();
  const proposal = useProposeCorrection();
  const { problem, track } = useCommandProblem();
  const decide = (p: ChangeProposalView, d: 'accept' | 'dismiss', reason: string) =>
    track(decision.submit({ period: periodRefOf(view), proposalId: p.id, decision: d, reason }));
  const propose = (draft: CorrectionDraft) =>
    track(proposal.submit({ period: periodRefOf(view), approvedRevision: view.publishedRevision ?? 0, ...draft }));
  const canPropose = canProposeCorrections && view.publishedRevision !== null && view.revision.lifecycle === 'approved' && !view.openProposalId;
  const items = proposals.data?.items ?? [];
  useSeekAnchor(anchor, pageListState(proposals));
  return (
    <Section title="Change proposals" headingLevel={3}>
      <div className="space-y-2 text-sm" data-testid="change-proposals">
        <FocusedListNotice anchor={anchor} what="proposals" />
        {items.length === 0 && <p className="text-muted-foreground">No proposals: the approved figures match the current inputs.</p>}
        {items.map((p) => (
          <ChangeProposalCard key={p.id} p={p} timezone={timezone} decide={canApproveRevisions && (isSuperAdmin || p.manual?.proposedBy !== userId) ? decide : null} />
        ))}
        {canPropose && <ProposeCorrectionDialog onPropose={propose} />}
        {problem && <EditorProblem problem={problem} />}
      </div>
    </Section>
  );
}
