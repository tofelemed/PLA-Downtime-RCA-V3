import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { MASTER_DATA_SORT_LABELS, RECORD_STATUS_FILTER_LABELS } from '@/features/ux-kit/labels';
import { cn } from '@/lib/utils';
import type { MasterDataSort, RecordStatusFilter } from '../api/master-data-types';
import type { ListFilters } from '../hooks/use-list-filters';
import { LabelledSearch } from './labelled-search';

export interface ListToolbarProps {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  /** accessible name and placeholder of the search box, e.g. "Search units" */
  searchLabel: string;
  /** no sort choice for lists that are not coded (templates sort by name) */
  sortLabels?: Partial<Record<MasterDataSort, string>>;
  /**
   * opt-in (Plant & equipment cleanup, 25 Oct 2026): every control h-9 with its label stacked above it
   * ("Search" over the search box), one bottom-aligned row
   */
  compact?: boolean;
  /** opt-in: scope controls placed first in the same row (e.g. the unit filter of the asset list) */
  leading?: ReactNode;
}

interface ChoiceProps {
  id: string;
  label: string;
  value: string;
  labels: Partial<Record<string, string>>;
  width: string;
  compact: boolean;
  onChange: (value: string) => void;
}

function Choice({ id, label, value, labels, width, compact, onChange }: ChoiceProps) {
  return (
    <div className={compact ? FIELD_CLASS : 'space-y-1'}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={cn(width, compact && 'h-9')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(labels).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type SearchProps = Pick<ListToolbarProps, 'filters' | 'onChange' | 'searchLabel'> & { compact: boolean };

function Search({ filters, onChange, searchLabel, compact }: SearchProps) {
  if (compact) return <LabelledSearch label={searchLabel} placeholder={`${searchLabel}...`} value={filters.q} onChange={(q) => onChange({ q })} />;
  return <DebouncedSearchInput value={filters.q} onChange={(q) => onChange({ q })} label={searchLabel} placeholder={`${searchLabel}...`} className="w-full max-w-xs" />;
}

/** Search (debounced), status and sort of a master-data list; every choice lives in the URL. */
export function ListToolbar({ filters, onChange, searchLabel, sortLabels = MASTER_DATA_SORT_LABELS, compact = false, leading }: ListToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {leading}
      <Search filters={filters} onChange={onChange} searchLabel={searchLabel} compact={compact} />
      <Choice
        id="md-status"
        label="Status"
        value={filters.status}
        labels={RECORD_STATUS_FILTER_LABELS}
        width="w-48"
        compact={compact}
        onChange={(status) => onChange({ status: status as RecordStatusFilter })}
      />
      <Choice id="md-sort" label="Sort" value={filters.sort} labels={sortLabels} width="w-40" compact={compact} onChange={(sort) => onChange({ sort: sort as MasterDataSort })} />
    </div>
  );
}
