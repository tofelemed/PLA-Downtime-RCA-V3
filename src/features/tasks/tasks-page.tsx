import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type TaskFilters, useTaskSummary, useTasksPage } from '@/api/v2/queries/administration-tasks';
import { Button } from '@/components/ui/button';
import { ALL, optionsOf } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable } from '@/features/ux-kit/data-table';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/ux-kit/labels';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { taskColumns } from './components/task-columns';
import { TaskSummary } from './components/task-summary';
import { TasksFilterBar } from './components/tasks-filter-bar';

const DEFAULTS = { q: '', status: ALL, priority: ALL, mine: '', overdue: '' } as const;
const STATUS_OPTIONS = optionsOf(TASK_STATUS_LABELS, 'All statuses');
const PRIORITY_OPTIONS = optionsOf(TASK_PRIORITY_LABELS, 'All priorities');

/** The shared report table look (compact rows, small uppercase headers); tasks have no provisional figures. */
const TASKS_LOOK = { provisional: false, ownEmpty: true } as const;
const SUMMARY_INFO = 'Counts use search, priority and My tasks. Status and Overdue only filter the task list.';

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
      <ReportLookContext.Provider value={TASKS_LOOK}>
        <section aria-labelledby="tasks-summary-title" className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <h2 id="tasks-summary-title" className="text-base font-semibold text-heading">Summary</h2>
            <KpiInfo label="the task counts" text={SUMMARY_INFO} />
          </div>
          <TaskSummary summary={summary.data} loading={summary.isLoading} isError={summary.isError} error={summary.error} onRetry={() => void summary.refetch()} />
        </section>
        <section aria-labelledby="tasks-list-title" className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
          <h2 id="tasks-list-title" className="text-base font-semibold text-heading">Tasks</h2>
          <TasksFilterBar values={values} statusOptions={STATUS_OPTIONS} priorityOptions={PRIORITY_OPTIONS} onChange={setValues} />
          <DataTable
            caption="Tasks"
            columns={columns}
            rows={tasks.rows}
            getRowKey={(task) => task.id}
            pager={tasks.pager}
            status={tasks.status}
            density="compact"
            empty={{ title: 'No tasks', text: 'No task matches the filters.' }}
            onRowClick={(task) => navigate(`/tasks/${task.id}`)}
            rowLabel={(task) => `Open task ${task.title}`}
          />
        </section>
      </ReportLookContext.Provider>
    </Page>
  );
}
