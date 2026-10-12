import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { MASTER_DATA_SORT_LABELS, RECORD_STATUS_FILTER_LABELS } from '@/features/ux-kit/labels';
import type { MasterDataSort, RecordStatusFilter } from '../api/master-data-types';
import type { ListFilters } from '../hooks/use-list-filters';

export interface ListToolbarProps {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  /** accessible name and placeholder of the search box, e.g. "Search units" */
  searchLabel: string;
  /** no sort choice for lists that are not coded (templates sort by name) */
  sortLabels?: Partial<Record<MasterDataSort, string>>;
}

/** Search (debounced), status and sort of a master-data list; every choice lives in the URL. */
export function ListToolbar({ filters, onChange, searchLabel, sortLabels = MASTER_DATA_SORT_LABELS }: ListToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <DebouncedSearchInput
        value={filters.q}
        onChange={(q) => onChange({ q })}
        label={searchLabel}
        placeholder={`${searchLabel}...`}
        className="w-full max-w-xs"
      />
      <div className="space-y-1">
        <Label htmlFor="md-status">Status</Label>
        <Select value={filters.status} onValueChange={(status) => onChange({ status: status as RecordStatusFilter })}>
          <SelectTrigger id="md-status" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RECORD_STATUS_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="md-sort">Sort</Label>
        <Select value={filters.sort} onValueChange={(sort) => onChange({ sort: sort as MasterDataSort })}>
          <SelectTrigger id="md-sort" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(sortLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
