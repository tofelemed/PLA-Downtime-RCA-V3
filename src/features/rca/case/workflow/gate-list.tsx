import { Link } from 'react-router-dom';
import type { RcaGateIssue } from '@/api/v2/types/rca-workflow';
import { StatusIcon } from '@/lib/icons';

export interface GateListProps {
  title: string;
  issues: readonly RcaGateIssue[];
  /** advice never blocks a move */
  tone: 'blocker' | 'advice';
  testId: string;
  /** where the Causes panel is (item 7: the coded root cause blocker links there) */
  causesPath?: string;
}

/** Item 7 closure blocker of cases under the coded root-cause rule. */
export const CODED_ROOT_CAUSE_MISSING = 'CODED_ROOT_CAUSE_MISSING';

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function IssueText({ issue, causesPath }: { issue: RcaGateIssue; causesPath?: string }) {
  if (issue.code !== CODED_ROOT_CAUSE_MISSING) return <>{sentence(issue.message)}</>;
  return (
    <span>
      At least one root cause with a cause code is required.
      {causesPath && (
        <>
          {' '}
          <Link to={causesPath} className="underline" data-testid="coded-root-cause-link">
            Open the causes
          </Link>
        </>
      )}
    </span>
  );
}

/** Blockers or advice of a workflow gate, in the server's words (the coded root-cause blocker in ours, with a link). */
export function GateList({ title, issues, tone, testId, causesPath }: GateListProps) {
  if (issues.length === 0) return null;
  const Icon = tone === 'blocker' ? StatusIcon.warning : StatusIcon.info;
  return (
    <div className="space-y-1" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-0.5 text-sm">
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.field}`} className="flex items-start gap-1" data-code={issue.code}>
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <IssueText issue={issue} causesPath={causesPath} />
          </li>
        ))}
      </ul>
    </div>
  );
}
