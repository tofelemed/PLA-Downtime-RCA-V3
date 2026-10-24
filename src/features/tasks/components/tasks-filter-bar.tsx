import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FilterSelect, type FilterOption } from '@/features/admin/shared/filter-select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';

export interface TasksFilterValues {
  q: string;
  status: string;
  priority: string;
  mine: string;
  overdue: string;
}

export interface TasksFilterBarProps {
  values: TasksFilterValues;
  statusOptions: readonly FilterOption[];
  priorityOptions: readonly FilterOption[];
  onChange: (patch: Partial<TasksFilterValues>) => void;
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex h-9 items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

/** One bottom-aligned row: search, status, priority (labels above, h-9), then the My tasks and Overdue toggles. */
export function TasksFilterBar({ values, statusOptions, priorityOptions, onChange }: TasksFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className={`${FIELD_CLASS} w-full sm:w-64`}>
        <Label htmlFor="tasks-search">Search</Label>
        <DebouncedSearchInput id="tasks-search" label="Search tasks" placeholder="Search tasks" className="max-w-none [&_input]:h-9" value={values.q} onChange={(q) => onChange({ q })} />
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="tasks-status">Status</Label>
        <FilterSelect id="tasks-status" label="Status filter" className="h-9" value={values.status} options={statusOptions} onChange={(status) => onChange({ status })} />
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="tasks-priority">Priority</Label>
        <FilterSelect id="tasks-priority" label="Priority filter" className="h-9" value={values.priority} options={priorityOptions} onChange={(priority) => onChange({ priority })} />
      </div>
      <Toggle id="tasks-mine" label="My tasks" checked={values.mine === '1'} onChange={(on) => onChange({ mine: on ? '1' : '' })} />
      <Toggle id="tasks-overdue" label="Overdue only" checked={values.overdue === '1'} onChange={(on) => onChange({ overdue: on ? '1' : '' })} />
    </div>
  );
}
