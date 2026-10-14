import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useChangeProposals } from '@/api/v2/queries/period-overview';
import { useProposalDecision } from '@/api/v2/queries/period-workflow';
import type { ChangeProposalView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { humanize, labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { EditorProblem } from '../editor/editor-problem';
import { periodRefOf } from '../hooks/use-draft-editor';
import { snapshotFigures } from '../model/snapshot-figures';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';
import { ReasonConfirm } from './reason-confirm';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ChangeProposalsPanelProps {
  view: ReconciliationView;
  timezone: string;
}

const STATE_LABELS: Readonly<Record<string, string>> = { open: 'Open', accepted: 'Accepted', dismissed: 'Dismissed', superseded: 'Superseded' };

function Snapshot({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  const figures = value ? snapshotFigures(value) : [];
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">{label}</summary>
      {value === null && <p>Calculated when the proposal is accepted.</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 sm:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Proposal({ p, timezone, decide }: { p: ChangeProposalView; timezone: string; decide: ((p: ChangeProposalView, d: 'accept' | 'dismiss', reason: string) => Promise<unknown>) | null }) {
  const { number } = useNumberFormat();
  return (
    <div className="space-y-1 rounded-md border p-2" data-testid="change-proposal" data-state={p.state}>
      <p>
        <Badge variant={p.state === 'open' ? 'destructive' : 'secondary'}>{labelOf(STATE_LABELS, p.state)}</Badge> {humanize(p.trigger)} · <PlantTime iso={p.createdAt} tz={timezone} withDate />
      </p>
      <Snapshot label="Before (approved)" value={p.before} />
      <Snapshot label="After (with the approved decisions)" value={p.after} />
      {p.affectedReports.length > 0 && <p className="text-xs">Affects {number(p.affectedReports.length)} earlier export(s) of the approved figures.</p>}
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
 * dismiss keeps the approval. Only manager approvers decide, so only they see the decision controls.
 */
export function ChangeProposalsPanel({ view, timezone }: ChangeProposalsPanelProps) {
  const { canApprovePeriods } = useCapabilities();
  const proposals = useChangeProposals(view.periodId);
  const decision = useProposalDecision();
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const decide = (p: ChangeProposalView, d: 'accept' | 'dismiss', reason: string) =>
    decision.submit({ period: periodRefOf(view), proposalId: p.id, decision: d, reason }).then(
      () => setProblem(null),
      (error: unknown) => {
        setProblem(workflowProblemOf(error));
        throw error;
      },
    );
  const items = proposals.data?.items ?? [];
  return (
    <Section title="Change proposals" headingLevel={3}>
      <div className="space-y-2 text-sm" data-testid="change-proposals">
        {items.length === 0 && <p className="text-muted-foreground">No proposals: the approved figures match the current inputs.</p>}
        {items.map((p) => (
          <Proposal key={p.id} p={p} timezone={timezone} decide={canApprovePeriods ? decide : null} />
        ))}
        {problem && <EditorProblem problem={problem} />}
      </div>
    </Section>
  );
}
