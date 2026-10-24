import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_EVIDENCE_TASK_LABELS, RCA_SERIES_MODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { verifiedText } from '../../model/evidence-form';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';
import { useRcaFormat } from '../../use-rca-format';
import { Fact, FactList } from './fact-list';
import { TaskOverdueBadge } from './task-overdue-badge';

type NameOf = (id: string | null) => string;

/** What the item is: type, description, source, when / where observed, classification and what it supports. */
export function EvidenceMainFacts({ item, assetName, supports }: { item: RcaEvidenceItem; assetName: NameOf; supports: string }) {
  const { dateTime } = useRcaFormat();
  return (
    <FactList testId="evidence-detail">
      <Fact label="Type">{item.type}</Fact>
      <Fact label="Description" long>
        {item.description}
      </Fact>
      <Fact label="Source">{item.source}</Fact>
      <Fact label="Observed at">{item.occurredAt ? dateTime(item.occurredAt) : null}</Fact>
      <Fact label="Asset">{item.assetId ? assetName(item.assetId) : null}</Fact>
      <Fact label="5P">{item.fiveP}</Fact>
      <Fact label="Severity">{item.severity}</Fact>
      <Fact label="Category">{item.category}</Fact>
      <Fact label="Location">{item.location}</Fact>
      <Fact label="Tags">{item.tags.join(', ')}</Fact>
      <Fact label="Supports">{supports}</Fact>
    </FactList>
  );
}

/** The evidence request: what, from whom, by when (overdue badge) and its status. */
export function EvidenceRequestFacts({ item, userName }: { item: RcaEvidenceItem; userName: NameOf }) {
  const { day } = useRcaFormat();
  return (
    <FactList>
      <Fact label={REQ.request} long>
        {item.task}
      </Fact>
      <Fact label={REQ.requestedFrom}>{item.taskAssigneeId && userName(item.taskAssigneeId)}</Fact>
      <Fact label={REQ.due}>
        {item.taskDueDate && (
          <span className="inline-flex flex-wrap items-center">
            {day(item.taskDueDate)}
            <TaskOverdueBadge item={item} />
          </span>
        )}
      </Fact>
      <Fact label={REQ.status}>{labelOf(RCA_EVIDENCE_TASK_LABELS, item.taskStatus, 'Pending')}</Fact>
    </FactList>
  );
}

/** Who collected the item and when, and who verified it when (recorded by the server). */
export function EvidenceRecordFacts({ item, userName }: { item: RcaEvidenceItem; userName: NameOf }) {
  const { dateTime } = useRcaFormat();
  const collected = [item.collectedBy ? userName(item.collectedBy) : null, item.collectedAt ? dateTime(item.collectedAt) : null].filter(Boolean).join(' · ');
  return (
    <FactList>
      <Fact label="Verified">
        <span data-testid="evidence-verified">{verifiedText(item, userName, dateTime)}</span>
      </Fact>
      <Fact label="Collected">{collected}</Fact>
    </FactList>
  );
}

/** The historian query of a "Time Series" item. */
export function SeriesFacts({ item }: { item: RcaEvidenceItem }) {
  const { dateTime } = useRcaFormat();
  const series = item.timeSeries;
  if (!series) return <p className="text-sm text-muted-foreground">No historian query recorded.</p>;
  return (
    <FactList>
      <Fact label="Streams / tags">{series.streams}</Fact>
      <Fact label="Mode">{labelOf(RCA_SERIES_MODE_LABELS, series.mode)}</Fact>
      <Fact label="From">{dateTime(series.start)}</Fact>
      <Fact label="To">{dateTime(series.end)}</Fact>
      <Fact label="Interval">{series.interval ?? (series.intervals ? `${series.intervals} intervals` : null)}</Fact>
      <Fact label="Summary types">{series.summaryTypes}</Fact>
    </FactList>
  );
}
