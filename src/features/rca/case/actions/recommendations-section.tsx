import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { useUserNames } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { isRecommendationClosed, RECOMMENDATION_PRIORITIES, RECOMMENDATION_STATUS_OPTIONS } from '../../model/recommendation-form';
import { useRcaFormat } from '../../use-rca-format';
import { CaseCard } from '../evidence/case-card';
import { ChoiceField, optionsOf } from '../evidence/form-controls';
import { SearchField } from '../evidence/search-field';
import { useCaseWorkspace } from '../case-context';
import { CreateTaskButton, TasksLink } from './create-task-button';
import { recommendationColumns } from './recommendation-columns';

interface Filters {
  text: string;
  status: string;
  priority: string;
}

const NO_FILTERS: Filters = { text: '', status: '', priority: '' };

const keep = (row: RcaRecommendationItem, f: Filters) =>
  (f.status === '' || (row.status ?? 'Open') === f.status) &&
  (f.priority === '' || row.priority === f.priority) &&
  (f.text === '' || `${row.title} ${row.description ?? ''}`.toLowerCase().includes(f.text.toLowerCase()));

function AddRecommendationLink({ to, testId }: { to: string; testId?: string }) {
  return (
    <Button asChild size="sm">
      <Link to={to} data-testid={testId}>
        <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
        Add recommendation
      </Link>
    </Button>
  );
}

/** Search, status and priority: one row, labels above h-9 controls. */
function FilterBar({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SearchField id="rec-search" label="Search recommendations" placeholder="Title or description" value={filters.text} onChange={(text) => onChange({ ...filters, text })} />
      <div className="w-44">
        <ChoiceField id="rec-status-filter" label="Status" value={filters.status} options={RECOMMENDATION_STATUS_OPTIONS} allowNone="All statuses" onChange={(status) => onChange({ ...filters, status })} />
      </div>
      <div className="w-40">
        <ChoiceField id="rec-priority-filter" label="Priority" value={filters.priority} options={optionsOf(RECOMMENDATION_PRIORITIES)} allowNone="All priorities" onChange={(priority) => onChange({ ...filters, priority })} />
      </div>
    </div>
  );
}

function emptyOf(total: number, readOnly: boolean, newPath: string, clear: () => void): DataTableEmpty {
  if (total > 0) {
    return { title: 'No recommendations', text: 'None matches the filters.', action: <Button type="button" size="sm" variant="outline" onClick={clear}>Clear filters</Button> };
  }
  return { title: 'No recommendations', text: 'No recommendation yet.', action: readOnly ? undefined : <AddRecommendationLink to={newPath} /> };
}

/** Recommendations of the case (stored with it): filters, progress, tasks; a row opens its edit page. */
export function RecommendationsSection() {
  const { number } = useNumberFormat();
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const navigate = useNavigate();
  const users = useUserNames();
  const { day } = useRcaFormat();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const deferred = useDeferredValue(filters);
  const rows = useMemo(() => rca.recommendations.filter((row) => keep(row, deferred)), [rca.recommendations, deferred]);
  const { canViewMoney: money } = useCapabilities();
  const cols = useMemo(() => recommendationColumns({ owner: users.nameOf, day, readOnly, basePath, money }), [users, day, readOnly, basePath, money]);
  const closed = rca.recommendations.filter((row) => isRecommendationClosed(row.status)).length;
  const newPath = `${basePath}/actions/recommendations/new`;
  const actions = readOnly ? null : (
    <>
      <CreateTaskButton />
      <TasksLink />
      <AddRecommendationLink to={newPath} testId="add-recommendation" />
    </>
  );
  return (
    <CaseCard title="Recommendations" count={`${number(rca.recommendations.length)} · ${number(closed)} closed`} actions={actions} testId="recommendations-card">
      <FilterBar filters={filters} onChange={setFilters} />
      <div data-testid="rec">
        <DataTable
          caption="Recommendations"
          columns={cols}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={emptyOf(rca.recommendations.length, readOnly, newPath, () => setFilters(NO_FILTERS))}
          onRowClick={readOnly ? undefined : (row) => navigate(`${basePath}/actions/recommendations/${encodeURIComponent(row.id)}/edit`)}
          rowLabel={(row) => `Edit recommendation ${row.title}`}
        />
      </div>
    </CaseCard>
  );
}
