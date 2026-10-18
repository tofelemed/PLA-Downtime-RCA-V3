import type { ChangeProposalView } from '@/api/v2/types/reconciliation';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useReasonCodeName } from '../hooks/use-reason-code-name';
import { type ProposalCodingChange, proposalCodingChangesOf, proposalFieldChangeText } from '../model/proposal-labels';

/** What changed on one line: the reason when it moved, then each changed cause classification. */
function changeWords(c: ProposalCodingChange, reasonName: (id: string | null) => string): string {
  const parts = c.before !== c.after ? [`Reason changed: ${reasonName(c.before)} → ${reasonName(c.after)}`] : [];
  return [...parts, ...c.fields.map(proposalFieldChangeText)].join(' · ');
}

/**
 * The loss lines a change proposal re-codes (Marun E2E note D, regression R3), so a reason or classification
 * change is seen by the manager who accepts it, not only the quantities: "Reason changed: SPEED-LOSS → none ·
 * availability 14 t", "OEE component changed: Performance → Availability · availability 14 t".
 */
export function ProposalCodingChanges({ p }: { p: ChangeProposalView }) {
  const reasonName = useReasonCodeName();
  const { decimal } = useNumberFormat();
  const changes = proposalCodingChangesOf(p.after);
  if (changes.length === 0) return null;
  return (
    <ul className="list-disc pl-5 text-xs" data-testid="proposal-coding-changes">
      {changes.map((c) => (
        <li key={c.autoKey}>
          {changeWords(c, reasonName)} · {c.kind} loss line {decimal(c.quantity)}
        </li>
      ))}
    </ul>
  );
}
