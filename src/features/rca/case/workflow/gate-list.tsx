import type { RcaGateIssue } from '@/api/v2/types/rca-workflow';
import { StatusIcon } from '@/lib/icons';

export interface GateListProps {
  title: string;
  issues: readonly RcaGateIssue[];
  /** advice never blocks a move */
  tone: 'blocker' | 'advice';
  testId: string;
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Blockers or advice of a workflow gate, in the server's words. */
export function GateList({ title, issues, tone, testId }: GateListProps) {
  if (issues.length === 0) return null;
  const Icon = tone === 'blocker' ? StatusIcon.warning : StatusIcon.info;
  return (
    <div className="space-y-1" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-0.5 text-sm">
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.field}`} className="flex items-start gap-1" data-code={issue.code}>
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {sentence(issue.message)}
          </li>
        ))}
      </ul>
    </div>
  );
}
