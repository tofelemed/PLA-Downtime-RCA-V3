import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_EVIDENCE_TASK_LABELS, RCA_SERIES_MODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { verifiedText } from '../../model/evidence-form';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';
import { useRcaFormat } from '../../use-rca-format';
import { CaseFact, CaseFacts } from '../components/case-facts';
import { TaskOverdueBadge } from './task-overdue-badge';

type NameOf = (id: string | null) => string;

/** What the item is: type, description, source, when / where observed, classification and what it supports. */
export function EvidenceMainFacts({ item, assetName, supports }: { item: RcaEvidenceItem; assetName: NameOf; supports: string }) {
  const { dateTime } = useRcaFormat();
  return (
    <CaseFacts testId="evidence-detail">
      <CaseFact label="Type">{item.type}</CaseFact>
      <CaseFact label="Description">
        {item.description}
      </CaseFact>
      <CaseFact label="Source">{item.source}</CaseFact>
      <CaseFact label="Observed at">{item.occurredAt ? dateTime(item.occurredAt) : null}</CaseFact>
      <CaseFact label="Asset">{item.assetId ? assetName(item.assetId) : null}</CaseFact>
      <CaseFact label="5P">{item.fiveP}</CaseFact>
      <CaseFact label="Severity">{item.severity}</CaseFact>
      <CaseFact label="Category">{item.category}</CaseFact>
      <CaseFact label="Location">{item.location}</CaseFact>
      <CaseFact label="Tags">{item.tags.join(', ')}</CaseFact>
      <CaseFact label="Supports">{supports}</CaseFact>
    </CaseFacts>
  );
}

/** The evidence request: what, from whom, by when (overdue badge) and its status. */
export function EvidenceRequestFacts({ item, userName }: { item: RcaEvidenceItem; userName: NameOf }) {
  const { day } = useRcaFormat();
  return (
    <CaseFacts>
      <CaseFact label={REQ.request}>
        {item.task}
      </CaseFact>
      <CaseFact label={REQ.requestedFrom}>{item.taskAssigneeId && userName(item.taskAssigneeId)}</CaseFact>
      <CaseFact label={REQ.due}>
        {item.taskDueDate && (
          <span className="inline-flex flex-wrap items-center">
            {day(item.taskDueDate)}
            <TaskOverdueBadge item={item} />
          </span>
        )}
      </CaseFact>
      <CaseFact label={REQ.status}>{labelOf(RCA_EVIDENCE_TASK_LABELS, item.taskStatus, 'Pending')}</CaseFact>
    </CaseFacts>
  );
}

/** Who collected the item and when, and who verified it when (recorded by the server). */
export function EvidenceRecordFacts({ item, userName }: { item: RcaEvidenceItem; userName: NameOf }) {
  const { dateTime } = useRcaFormat();
  const collected = [item.collectedBy ? userName(item.collectedBy) : null, item.collectedAt ? dateTime(item.collectedAt) : null].filter(Boolean).join(' · ');
  return (
    <CaseFacts>
      <CaseFact label="Verified">
        <span data-testid="evidence-verified">{verifiedText(item, userName, dateTime)}</span>
      </CaseFact>
      <CaseFact label="Collected">{collected}</CaseFact>
    </CaseFacts>
  );
}

/** The historian query of a "Time Series" item. */
export function SeriesFacts({ item }: { item: RcaEvidenceItem }) {
  const { dateTime } = useRcaFormat();
  const series = item.timeSeries;
  if (!series) return <p className="text-sm text-muted-foreground">No historian query recorded.</p>;
  return (
    <CaseFacts>
      <CaseFact label="Streams / tags">{series.streams}</CaseFact>
      <CaseFact label="Mode">{labelOf(RCA_SERIES_MODE_LABELS, series.mode)}</CaseFact>
      <CaseFact label="From">{dateTime(series.start)}</CaseFact>
      <CaseFact label="To">{dateTime(series.end)}</CaseFact>
      <CaseFact label="Interval">{series.interval ?? (series.intervals ? `${series.intervals} intervals` : null)}</CaseFact>
      <CaseFact label="Summary types">{series.summaryTypes}</CaseFact>
    </CaseFacts>
  );
}
