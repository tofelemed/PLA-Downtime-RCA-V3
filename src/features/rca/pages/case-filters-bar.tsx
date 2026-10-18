import { RCA_PRIORITIES, RCA_STATUSES } from '@/api/v2/types/rca';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { ALL, type CaseListFilters } from '../model/case-filters';
import { statusLabel } from '../model/rca-labels';

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

const STATUS_OPTIONS: Option[] = [{ value: ALL, label: 'All statuses' }, ...RCA_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))];
const PRIORITY_OPTIONS: Option[] = [{ value: ALL, label: 'All priorities' }, ...RCA_PRIORITIES.map((p) => ({ value: p, label: p }))];
const DUE_OPTIONS: Option[] = [
  { value: ALL, label: 'Any target date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'on-time', label: 'Not overdue' },
];
const OPEN_OPTIONS: Option[] = [
  { value: ALL, label: 'Open and closed' },
  { value: 'true', label: 'Open only' },
  { value: 'false', label: 'Closed only' },
];

/** Search (debounced) and the status / priority / due / open filters; every filter is applied by the server. */
export function CaseFiltersBar({ value, onChange }: { value: CaseListFilters; onChange: (next: CaseListFilters) => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" data-testid="case-filters">
      <div className="space-y-1">
        <p className="text-sm font-medium" aria-hidden="true">
          Search
        </p>
        <DebouncedSearchInput
          label="Search investigation titles"
          placeholder="Search titles"
          value={value.q}
          onChange={(q) => onChange({ ...value, q })}
          className="sm:w-72"
        />
      </div>
      <FilterSelect id="case-status" label="Status" value={value.status} options={STATUS_OPTIONS} onChange={(status) => onChange({ ...value, status })} />
      <FilterSelect id="case-priority" label="Priority" value={value.priority} options={PRIORITY_OPTIONS} onChange={(priority) => onChange({ ...value, priority })} />
      <FilterSelect id="case-due" label="Target date" value={value.due} options={DUE_OPTIONS} onChange={(due) => onChange({ ...value, due })} />
      <FilterSelect id="case-open" label="Open / closed" value={value.open} options={OPEN_OPTIONS} onChange={(open) => onChange({ ...value, open })} />
    </div>
  );
}
