import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RCA_ACTION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { ACTION_STATUSES, ANY, DEFAULT_ACTION_FILTERS, toActionQuery, type ActionQueueFilters } from '../model/action-queue-filters';
import { useUnitNames } from '../use-unit-names';
import { ActionQueueTable } from './action-queue-table';

interface Option {
  value: string;
  label: string;
}

function FilterSelect(props: { id: string; label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger id={props.id} className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 sm:pb-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

const STATUS_OPTIONS: Option[] = [{ value: ANY, label: 'All statuses' }, ...ACTION_STATUSES.map((s) => ({ value: s, label: RCA_ACTION_STATUS_LABELS[s] }))];

export interface ActionQueueTabProps {
  filters: ActionQueueFilters;
  onChange: (next: ActionQueueFilters) => void;
}

/** F-7: the "Actions" tab of `/rca` — Mine (default on), Overdue, Status and Unit, all filtered by the server. */
export function ActionQueueTab({ filters, onChange }: ActionQueueTabProps) {
  const { units } = useUnitNames();
  const unitOptions: Option[] = [{ value: ANY, label: 'All units' }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))];
  const set = (patch: Partial<ActionQueueFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="space-y-3" data-testid="action-queue">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" data-testid="action-filters">
        <Toggle id="action-mine" label="Mine" checked={filters.mine} onChange={(mine) => set({ mine })} />
        <Toggle id="action-overdue" label="Overdue" checked={filters.overdue} onChange={(overdue) => set({ overdue })} />
        <FilterSelect id="action-status" label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(status) => set({ status })} />
        <FilterSelect id="action-unit" label="Unit" value={filters.unitId} options={unitOptions} onChange={(unitId) => set({ unitId })} />
      </div>
      <ActionQueueTable
        filters={toActionQuery(filters)}
        empty={{
          title: 'No actions',
          text: filters.mine ? 'You own no action that matches these filters.' : 'No action matches these filters.',
          action: (
            <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_ACTION_FILTERS)}>
              Reset filters
            </Button>
          ),
        }}
      />
    </div>
  );
}
