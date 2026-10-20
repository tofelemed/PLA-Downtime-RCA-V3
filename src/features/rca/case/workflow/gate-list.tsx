import { Link } from 'react-router-dom';
import type { RcaGateIssue } from '@/api/v2/types/rca-workflow';
import { StatusIcon } from '@/lib/icons';
import { gateMessage, type GateLinks } from '../../model/gate-messages';

export interface GateListProps {
  title: string;
  issues: readonly RcaGateIssue[];
  /** advice never blocks a move */
  tone: 'blocker' | 'advice';
  testId: string;
  /** where each issue is fixed (Analysis tools, Definition, Causes); without them the text stands alone */
  links?: GateLinks;
}

/** Item 7 closure blocker of cases under the coded root-cause rule. */
export const CODED_ROOT_CAUSE_MISSING = 'CODED_ROOT_CAUSE_MISSING';

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function IssueText({ issue, links }: { issue: RcaGateIssue; links?: GateLinks }) {
  if (!links) return <>{sentence(issue.message)}</>;
  const message = gateMessage(issue, links);
  return (
    <span>
      {message.text}
      {message.links.map((link) => (
        <span key={link.to}>
          {' '}
          <Link to={link.to} className="underline" data-testid={link.testId}>
            {link.label}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Blockers or advice of a workflow gate, per code in our words with a link to where each is fixed. */
export function GateList({ title, issues, tone, testId, links }: GateListProps) {
  if (issues.length === 0) return null;
  const Icon = tone === 'blocker' ? StatusIcon.warning : StatusIcon.info;
  return (
    <div className="space-y-1" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-0.5 text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.field}-${index}`} className="flex items-start gap-1" data-code={issue.code}>
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <IssueText issue={issue} links={links} />
          </li>
        ))}
      </ul>
    </div>
  );
}
