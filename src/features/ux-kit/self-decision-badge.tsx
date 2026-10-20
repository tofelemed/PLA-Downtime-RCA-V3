import { StatusBadge } from './status-badge';
import type { SelfDecisionKind } from './self-decision-kind';

const WORDS: Readonly<Record<SelfDecisionKind, string>> = {
  approved: 'Self-approved (SuperAdmin)',
  decided: 'Self-decided (SuperAdmin)',
};

const EXPLANATION =
  'A SuperAdmin decided a record they took part in. Separation of duties was waived under the permanent SuperAdmin authority (owner decision 2026-10-16).';

export interface SelfDecisionBadgeProps {
  /** the server's `selfDecided` flag; nothing is shown unless it is true */
  selfDecided: boolean | null | undefined;
  /** "approved" for approvals, "decided" for rejections, reviews and sign-offs */
  kind?: SelfDecisionKind;
  className?: string;
}

/**
 * Item 1.3: marks a SuperAdmin self-decision. The flag is computed by the server; the badge only shows it,
 * in words with the warning tone and an explanation for assistive technology.
 */
export function SelfDecisionBadge({ selfDecided, kind = 'approved', className }: SelfDecisionBadgeProps) {
  if (!selfDecided) return null;
  return (
    <StatusBadge tone="warning" title={EXPLANATION} data-testid="self-decision-badge" className={className}>
      {WORDS[kind]}
      <span className="sr-only">. {EXPLANATION}</span>
    </StatusBadge>
  );
}
