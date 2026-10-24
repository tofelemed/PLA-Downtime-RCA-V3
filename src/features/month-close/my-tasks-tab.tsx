import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTasksPage, type TaskFilters } from '@/api/v2/queries/administration-tasks';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { taskColumns } from '@/features/tasks/components/task-columns';
import { DataTable } from '@/features/ux-kit/data-table';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { MyWorkCard } from './my-work-card';
import { MY_WORK_LOOK } from './my-work-look';

/** The signed-in user's open tasks, earliest due first (server filters of `GET /v2/tasks`). */
const MY_OPEN_TASKS: TaskFilters = { assignedToMe: true, statuses: ['Open', 'In Progress'], sort: 'dueDate' };

/** The full Tasks page filtered to the user's tasks. */
const MY_TASKS_HREF = '/tasks?mine=1';

/**
 * "My work" → Tasks: a compact, read-only list of the user's open tasks (no assignee column — they are
 * all the user's); a row opens the task, and the footer opens the Tasks page filtered to "My tasks".
 */
export function MyTasksTab() {
  const navigate = useNavigate();
  const dates = usePlantDates();
  const tasks = useTasksPage(MY_OPEN_TASKS);
  const columns = useMemo(() => taskColumns(dates.date, false).filter((column) => column.id !== 'assignee'), [dates]);
  return (
    <ReportLookContext.Provider value={MY_WORK_LOOK}>
      <MyWorkCard
        title="My open tasks"
        testId="my-work-tasks"
        actions={
          <Link className="text-sm underline" to={MY_TASKS_HREF}>
            All my tasks
          </Link>
        }
      >
        <DataTable
          caption="My open tasks"
          columns={columns}
          rows={tasks.rows}
          getRowKey={(task) => task.id}
          pager={tasks.pager}
          status={tasks.status}
          density="compact"
          empty={{ title: 'No open tasks', text: 'No open or in-progress task is assigned to you.' }}
          onRowClick={(task) => navigate(`/tasks/${task.id}`)}
          rowLabel={(task) => `Open task ${task.title}`}
        />
      </MyWorkCard>
    </ReportLookContext.Provider>
  );
}
