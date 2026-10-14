import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_RECOMMENDATION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { isRecommendationClosed, RECOMMENDATION_PRIORITIES, RECOMMENDATION_STATUSES } from '../../model/recommendation-form';
import { useRcaFormat } from '../../use-rca-format';
import { ChoiceField, optionsOf } from '../evidence/form-controls';
import { useCaseWorkspace } from '../case-context';
import { CreateTaskButton, TasksLink } from './create-task-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

interface Filters {
  text: string;
  status: string;
  priority: string;
}

function columns(owner: (id: string | null) => string, day: (v: string | null) => string, readOnly: boolean): DataTableColumn<RcaRecommendationItem>[] {
  const base: DataTableColumn<RcaRecommendationItem>[] = [
    { id: 'title', header: 'Recommendation', cell: (row) => <span className="font-medium">{row.title}</span> },
    { id: 'status', header: 'Status', cell: (row) => <Badge variant="secondary">{labelOf(RCA_RECOMMENDATION_STATUS_LABELS, row.status, 'Open')}</Badge>, nowrap: true },
    { id: 'priority', header: 'Priority', cell: (row) => row.priority ?? '—', nowrap: true },
    { id: 'owner', header: 'Owner', cell: (row) => owner(row.ownerId) },
    { id: 'due', header: 'Due', cell: (row) => day(row.dueDate), nowrap: true },
    { id: 'cost', header: 'Est. cost', cell: (row) => row.estimatedCost ?? '—', align: 'right', nowrap: true },
  ];
  return readOnly ? base : [...base, { id: 'task', header: 'Task', headerLabel: 'Task', cell: (row) => <CreateTaskButton recommendation={row} /> }];
}

const keep = (row: RcaRecommendationItem, f: Filters) =>
  (f.status === '' || (row.status ?? 'Open') === f.status) &&
  (f.priority === '' || row.priority === f.priority) &&
  (f.text === '' || `${row.title} ${row.description ?? ''}`.toLowerCase().includes(f.text.toLowerCase()));

/** Recommendations of the case (stored with it): filters, progress, tasks; a row opens its edit page. */
export function RecommendationsSection() {
  const { number } = useNumberFormat();
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const navigate = useNavigate();
  const users = useUserNames();
  const { day } = useRcaFormat();
  const [filters, setFilters] = useState<Filters>({ text: '', status: '', priority: '' });
  const deferred = useDeferredValue(filters);
  const rows = useMemo(() => rca.recommendations.filter((row) => keep(row, deferred)), [rca.recommendations, deferred]);
  const cols = useMemo(() => columns(users.nameOf, day, readOnly), [users, day, readOnly]);
  const closed = rca.recommendations.filter((row) => isRecommendationClosed(row.status)).length;
  const actions = readOnly ? null : (
    <>
      <CreateTaskButton />
      <TasksLink />
      <Button asChild size="sm">
        <Link to={`${basePath}/actions/recommendations/new`} data-testid="add-recommendation">
          <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
          Add recommendation
        </Link>
      </Button>
    </>
  );
  return (
    <Section title="Recommendations" description={`${number(rca.recommendations.length)} recommendation(s), ${number(closed)} closed.`} actions={actions}>
      <div className="space-y-3" data-testid="rec">
        <div className="flex flex-wrap items-end gap-3">
          <Input className="max-w-xs" aria-label="Search recommendations" placeholder="Search recommendations" value={filters.text} onChange={(e) => setFilters({ ...filters, text: e.target.value })} />
          <ChoiceField id="rec-status-filter" label="Status" value={filters.status} options={optionsOf(RECOMMENDATION_STATUSES)} allowNone="All statuses" onChange={(status) => setFilters({ ...filters, status })} />
          <ChoiceField id="rec-priority-filter" label="Priority" value={filters.priority} options={optionsOf(RECOMMENDATION_PRIORITIES)} allowNone="All priorities" onChange={(priority) => setFilters({ ...filters, priority })} />
        </div>
        <DataTable
          caption="Recommendations"
          columns={cols}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={{ title: 'No recommendations', text: rca.recommendations.length ? 'None matches the filters.' : 'No recommendation yet.' }}
          onRowClick={readOnly ? undefined : (row) => navigate(`${basePath}/actions/recommendations/${encodeURIComponent(row.id)}/edit`)}
          rowLabel={(row) => `Edit recommendation ${row.title}`}
        />
      </div>
    </Section>
  );
}
