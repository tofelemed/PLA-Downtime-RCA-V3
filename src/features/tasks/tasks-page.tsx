import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type TaskFilters, useTaskSummary, useTasksPage } from '@/api/v2/queries/administration-tasks';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ALL, FilterSelect, optionsOf } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable } from '@/features/ux-kit/data-table';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/ux-kit/labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { taskColumns } from './components/task-columns';
import { TaskSummary } from './components/task-summary';

const DEFAULTS = { q: '', status: ALL, priority: ALL, mine: '', overdue: '' } as const;
const STATUS_OPTIONS = optionsOf(TASK_STATUS_LABELS, 'All statuses');
const PRIORITY_OPTIONS = optionsOf(TASK_PRIORITY_LABELS, 'All priorities');

function toFilters(values: Record<keyof typeof DEFAULTS, string>): TaskFilters {
  return {
    q: values.q || undefined,
    statuses: values.status === ALL ? undefined : [values.status],
    priorities: values.priority === ALL ? undefined : [values.priority],
    assignedToMe: values.mine === '1',
    overdue: values.overdue === '1',
  };
}

/** Action items of the selected plant (owner requirement "v2 only": replaces the v1 Tasks page). */
export function TasksPage() {
  const { canViewOperations } = useCapabilities();
  return (
    <PageGate title="Tasks" allowed={canViewOperations} deniedText="You don't have permission to see tasks.">
      <TasksScreen />
    </PageGate>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function TasksScreen() {
  const navigate = useNavigate();
  const { canWriteTasks } = useCapabilities();
  const dates = usePlantDates();
  const [values, setValues] = useUrlFilters(DEFAULTS);
  const filters = toFilters(values);
  const tasks = useTasksPage(filters);
  const summary = useTaskSummary(filters);
  const columns = useMemo(() => taskColumns(dates.date, canWriteTasks), [dates, canWriteTasks]);
  return (
    <Page width="wide">
      <PageHeader
        title="Tasks"
        description="Assign, track and complete tasks linked to investigations, events and plans."
        actions={
          canWriteTasks && (
            <Button asChild>
              <Link to="/tasks/new">
                <ActionIcon.add aria-hidden="true" />
                New task
              </Link>
            </Button>
          )
        }
      />
      <Section title="Summary" description="Counts use search, priority and My tasks. Status and Overdue only filter the task list.">
        <TaskSummary summary={summary.data} loading={summary.isLoading} isError={summary.isError} error={summary.error} onRetry={() => void summary.refetch()} />
      </Section>
      <Section title="Tasks">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <DebouncedSearchInput label="Search tasks" value={values.q} onChange={(q) => setValues({ q })} />
          <FilterSelect label="Status filter" value={values.status} options={STATUS_OPTIONS} onChange={(status) => setValues({ status })} />
          <FilterSelect label="Priority filter" value={values.priority} options={PRIORITY_OPTIONS} onChange={(priority) => setValues({ priority })} />
          <Toggle id="tasks-mine" label="My tasks" checked={values.mine === '1'} onChange={(on) => setValues({ mine: on ? '1' : '' })} />
          <Toggle id="tasks-overdue" label="Overdue only" checked={values.overdue === '1'} onChange={(on) => setValues({ overdue: on ? '1' : '' })} />
        </div>
        <DataTable
          caption="Tasks"
          columns={columns}
          rows={tasks.rows}
          getRowKey={(task) => task.id}
          pager={tasks.pager}
          status={tasks.status}
          empty={{ title: 'No tasks', text: 'No task matches the filters.' }}
          onRowClick={(task) => navigate(`/tasks/${task.id}`)}
          rowLabel={(task) => `Open task ${task.title}`}
        />
      </Section>
    </Page>
  );
}
