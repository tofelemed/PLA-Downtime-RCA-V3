import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_EVIDENCE_TASK_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { EVIDENCE_TYPES } from '../../model/evidence-form';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';

function columns(day: (value: string | null) => string): DataTableColumn<RcaEvidenceItem>[] {
  return [
    { id: 'title', header: 'Evidence', cell: (row) => <span className="font-medium">{row.title}</span> },
    { id: 'type', header: 'Type', cell: (row) => row.type ?? 'Note', nowrap: true },
    { id: 'fiveP', header: '5P', cell: (row) => (row.fiveP ? <Badge variant="outline">{row.fiveP}</Badge> : '—') },
    { id: 'task', header: 'Task', cell: (row) => <span className="line-clamp-2">{row.task ?? '—'}</span> },
    { id: 'due', header: 'Task due', cell: (row) => day(row.taskDueDate), nowrap: true },
    { id: 'status', header: 'Task status', cell: (row) => labelOf(RCA_EVIDENCE_TASK_LABELS, row.taskStatus, 'Pending'), nowrap: true },
    { id: 'verified', header: 'Verified', cell: (row) => (row.verified ? 'Yes' : 'No'), nowrap: true },
    { id: 'files', header: 'Files', cell: (row) => String(row.attachments.length), align: 'right' },
  ];
}

/** Text search over the case's evidence (in memory: the list is part of the case). */
function matches(item: RcaEvidenceItem, text: string, collector: string): boolean {
  if (!text) return true;
  const haystack = [item.title, item.type, item.description, item.task, collector, ...item.tags].join(' ').toLowerCase();
  return haystack.includes(text.toLowerCase());
}

/** `/rca/:caseId/evidence`: the evidence of the case with counts per type; rows open the item. */
export function EvidenceListPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const navigate = useNavigate();
  const users = useUserNames();
  const { day } = useRcaFormat();
  const [text, setText] = useState('');
  const search = useDeferredValue(text.trim());
  const rows = useMemo(() => rca.evidence.filter((item) => matches(item, search, users.nameOf(item.collectedBy))), [rca.evidence, search, users]);
  const cols = useMemo(() => columns(day), [day]);
  const counts = EVIDENCE_TYPES.map((type) => ({ type, count: rca.evidence.filter((item) => (item.type ?? 'Note') === type).length }));
  const add = readOnly ? null : (
    <Button asChild size="sm">
      <Link to={`${basePath}/evidence/new`} data-testid="add-evidence">
        <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
        Add evidence
      </Link>
    </Button>
  );
  return (
    <Section title="Evidence" description="Photos, documents, notes and historian queries collected for this case." actions={add}>
      <div className="space-y-3" data-testid="evidence-list">
        <div className="flex flex-wrap items-center gap-2" aria-label="Evidence by type">
          {counts.map(({ type, count }) => (
            <Badge key={type} variant="secondary">
              {type}: {count}
            </Badge>
          ))}
        </div>
        <Input className="max-w-sm" aria-label="Search evidence" placeholder="Search title, type, task or collector" value={text} onChange={(e) => setText(e.target.value)} />
        <DataTable
          caption="Evidence of the case"
          columns={cols}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={{ title: 'No evidence', text: search ? 'No evidence matches the search.' : 'Nothing collected yet.' }}
          onRowClick={(row) => navigate(`${basePath}/evidence/${encodeURIComponent(row.id)}`)}
          rowLabel={(row) => `Open evidence ${row.title}`}
        />
      </div>
    </Section>
  );
}
