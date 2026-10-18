import type { ReactNode } from 'react';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Badge } from '@/components/ui/badge';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

const words = (value: string) => value.replace(/_/g, ' ');

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:gap-3">
      <dt className="text-sm font-medium text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

/** What is asked: the workflow, the record and its version, scope, who requested it and when, and the approval roles. */
export function ApprovalDetailSummary({ item }: { item: ApprovalItem }) {
  const { timezone } = usePlantTimezone();
  return (
    <dl className="space-y-3" data-testid="approval-summary">
      <Row term="Workflow">{item.kindLabel}</Row>
      <Row term="Record">
        {item.title}
        {item.version != null ? ` · version ${item.version}` : ''}
      </Row>
      <Row term="State">
        <Badge variant="secondary">{words(item.state)}</Badge>
      </Row>
      <Row term="Unit">{item.unitName ?? 'Plant-wide'}</Row>
      <Row term="Requested by">{item.authorName ?? (item.authorId ? `User ${item.authorId}` : 'System / legacy record')}</Row>
      <Row term="Submitted">
        <PlantTime iso={item.createdAt} tz={timezone} withDate />
      </Row>
      <Row term="Approval roles">{item.requiredRoles.map(words).join(' / ')}</Row>
      {item.summary && (
        <Row term="Summary">
          <span className="whitespace-pre-wrap">{item.summary}</span>
        </Row>
      )}
    </dl>
  );
}
