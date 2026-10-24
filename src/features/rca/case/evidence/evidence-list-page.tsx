import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_EVIDENCE_TASK_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { EVIDENCE_TYPES } from '../../model/evidence-form';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from './case-card';
import { SearchField } from './search-field';
import { TaskOverdueBadge } from './task-overdue-badge';

function columns(day: (value: string | null) => string, userName: (id: string | null) => string): DataTableColumn<RcaEvidenceItem>[] {
  return [
    { id: 'title', header: 'Evidence', cell: (row) => <span className="font-medium">{row.title}</span> },
    { id: 'type', header: 'Type', cell: (row) => row.type ?? 'Note', nowrap: true },
    { id: 'fiveP', header: '5P', cell: (row) => (row.fiveP ? <Badge variant="outline" className="whitespace-nowrap">{row.fiveP}</Badge> : '—'), nowrap: true },
    { id: 'task', header: REQ.request, cell: (row) => <span className="line-clamp-2">{row.task ?? '—'}</span> },
    { id: 'assignee', header: REQ.requestedFrom, cell: (row) => (row.taskAssigneeId ? userName(row.taskAssigneeId) : '—') },
    {
      id: 'due',
      header: REQ.due,
      cell: (row) => (
        <span className="inline-flex items-center whitespace-nowrap">
          {day(row.taskDueDate)}
          <TaskOverdueBadge item={row} />
        </span>
      ),
      nowrap: true,
    },
    { id: 'status', header: REQ.status, cell: (row) => labelOf(RCA_EVIDENCE_TASK_LABELS, row.taskStatus, 'Pending'), nowrap: true },
    { id: 'verified', header: 'Verified', cell: (row) => (row.verified ? 'Yes' : 'No'), nowrap: true },
    { id: 'files', header: 'Files', cell: (row) => row.attachments.length, align: 'right', nowrap: true },
  ];
}

/** Text search over the case's evidence (in memory: the list is part of the case). */
function matches(item: RcaEvidenceItem, text: string, collector: string): boolean {
  if (!text) return true;
  const haystack = [item.title, item.type, item.description, item.task, collector, ...item.tags].join(' ').toLowerCase();
  return haystack.includes(text.toLowerCase());
}

function AddEvidenceLink({ to, testId }: { to: string; testId?: string }) {
  return (
    <Button asChild size="sm">
      <Link to={to} data-testid={testId}>
        <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
        Add evidence
      </Link>
    </Button>
  );
}

/** The number of items per evidence type, as small badges that never wrap. */
function TypeCounts({ evidence }: { evidence: readonly RcaEvidenceItem[] }) {
  const { number } = useNumberFormat();
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Evidence by type">
      {EVIDENCE_TYPES.map((type) => (
        <Badge key={type} variant="secondary" className="whitespace-nowrap font-normal">
          {type} {number(evidence.filter((item) => (item.type ?? 'Note') === type).length)}
        </Badge>
      ))}
    </div>
  );
}

/** `/rca/:caseId/evidence`: the evidence of the case with counts per type; rows open the item. */
export function EvidenceListPage() {
  const { number } = useNumberFormat();
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const navigate = useNavigate();
  const peopleIds = useMemo(() => rca.evidence.flatMap((item) => [item.collectedBy, item.taskAssigneeId]), [rca.evidence]);
  const users = useUserNames(peopleIds);
  const { day } = useRcaFormat();
  const [text, setText] = useState('');
  const search = useDeferredValue(text.trim());
  const rows = useMemo(() => rca.evidence.filter((item) => matches(item, search, users.nameOf(item.collectedBy))), [rca.evidence, search, users]);
  const cols = useMemo(() => columns(day, users.nameOf), [day, users.nameOf]);
  const newPath = `${basePath}/evidence/new`;
  const empty: DataTableEmpty = search
    ? { title: 'No evidence', text: 'No evidence matches the search.', action: <Button type="button" size="sm" variant="outline" onClick={() => setText('')}>Clear search</Button> }
    : { title: 'No evidence', text: 'Nothing collected yet.', action: readOnly ? undefined : <AddEvidenceLink to={newPath} /> };
  return (
    <CaseCard
      title="Evidence"
      count={number(rca.evidence.length)}
      info="Photos, documents, notes and historian queries collected for this investigation."
      actions={readOnly ? null : <AddEvidenceLink to={newPath} testId="add-evidence" />}
      testId="evidence-card"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SearchField id="evidence-search" label="Search evidence" placeholder="Title, type, request or collector" value={text} onChange={setText} />
        <TypeCounts evidence={rca.evidence} />
      </div>
      <div data-testid="evidence-list">
        <DataTable
          caption="Evidence of the investigation"
          columns={cols}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={empty}
          onRowClick={(row) => navigate(`${basePath}/evidence/${encodeURIComponent(row.id)}`)}
          rowLabel={(row) => `Open evidence ${row.title}`}
        />
      </div>
    </CaseCard>
  );
}
