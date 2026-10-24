import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { MASTER_DATA_SORT_LABELS, RECORD_STATUS_FILTER_LABELS } from '@/features/ux-kit/labels';
import type { MasterDataSort, RecordStatusFilter } from '../api/master-data-types';
import { LabelledSearch } from '../components/labelled-search';
import type { ListFilters } from '../hooks/use-list-filters';

export interface RcaListToolbarProps {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  /** accessible name of the search box, e.g. "Search templates" */
  searchLabel: string;
  sortLabels?: Partial<Record<MasterDataSort, string>>;
}

interface ChoiceProps {
  id: string;
  label: string;
  value: string;
  options: Partial<Record<string, string>>;
  onChange: (value: string) => void;
  width: string;
}

function Choice({ id, label, value, options, onChange, width }: ChoiceProps) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={`h-9 ${width}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The filter row of the RCA library lists (configuration cleanup): Search, Status and Sort with their labels
 * above, every control h-9; every choice lives in the URL. (The shared ListToolbar of the other master-data
 * lists keeps its own look.)
 */
export function RcaListToolbar({ filters, onChange, searchLabel, sortLabels = MASTER_DATA_SORT_LABELS }: RcaListToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="rca-list-filters">
      <LabelledSearch label={searchLabel} value={filters.q} onChange={(q) => onChange({ q })} />
      <Choice id="md-status" label="Status" value={filters.status} options={RECORD_STATUS_FILTER_LABELS} onChange={(status) => onChange({ status: status as RecordStatusFilter })} width="w-48" />
      <Choice id="md-sort" label="Sort" value={filters.sort} options={sortLabels} onChange={(sort) => onChange({ sort: sort as MasterDataSort })} width="w-40" />
    </div>
  );
}
