import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChangeProposals } from '@/api/v2/queries/period-overview';
import { useProposalDecision } from '@/api/v2/queries/period-workflow';
import type { ChangeProposalView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { EditorProblem } from '../editor/editor-problem';
import { periodRefOf } from '../hooks/use-draft-editor';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';

export interface ChangeProposalsPanelProps {
  view: ReconciliationView;
  timezone: string;
}

function Snapshot({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">{label}</summary>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap">{value ? JSON.stringify(value, null, 2) : 'resolved when accepted'}</pre>
    </details>
  );
}

/**
 * Late corrections of an approved period (WF04): before / after from the server; accept opens a revision,
 * dismiss keeps the approval. Only manager approvers decide, so only they see the decision controls.
 */
export function ChangeProposalsPanel({ view, timezone }: ChangeProposalsPanelProps) {
  const { canApprovePeriods } = useCapabilities();
  const proposals = useChangeProposals(view.periodId);
  const decide = useProposalDecision();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const act = (p: ChangeProposalView, decision: 'accept' | 'dismiss') =>
    decide.submit({ period: periodRefOf(view), proposalId: p.id, decision, reason: reason.trim() }).then(
      () => setProblem(null),
      (error: unknown) => setProblem(workflowProblemOf(error)),
    );
  const items = proposals.data?.items ?? [];
  return (
    <section className="space-y-2 text-sm" data-testid="change-proposals">
      <h3 className="font-medium">Change proposals</h3>
      {items.length === 0 && <p className="text-muted-foreground">No proposals: the approved figures match the current inputs.</p>}
      {items.map((p) => (
        <div key={p.id} className="space-y-1 rounded-md border p-2" data-testid="change-proposal" data-state={p.state}>
          <p>
            <Badge variant={p.state === 'open' ? 'destructive' : 'secondary'}>{p.state}</Badge> {p.trigger.replace(/_/g, ' ')} · <PlantTime iso={p.createdAt} tz={timezone} withDate />
          </p>
          <Snapshot label="Before (approved)" value={p.before} />
          <Snapshot label="After (preview with the approved decisions)" value={p.after} />
          {p.affectedReports.length > 0 && <p className="text-xs">Affected exports: {p.affectedReports.map((r) => r.exportId.slice(0, 8)).join(', ')}</p>}
          {p.state === 'open' && canApprovePeriods && (
            <div className="flex flex-wrap gap-2">
              <Input className="h-8 max-w-xs" aria-label="Decision reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" disabled={!reason.trim() || decide.isPending} onClick={() => void act(p, 'accept')}>
                Accept (new revision)
              </Button>
              <Button size="sm" variant="outline" disabled={!reason.trim() || decide.isPending} onClick={() => void act(p, 'dismiss')}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      ))}
      {problem && <EditorProblem problem={problem} />}
    </section>
  );
}
