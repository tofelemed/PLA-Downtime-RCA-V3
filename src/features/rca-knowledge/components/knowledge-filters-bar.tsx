import { useMemo } from 'react';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { useUnitNames } from '@/features/rca/use-unit-names';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { ALL, type KnowledgeFilterState, type PublishedChoice } from '../model/knowledge-filters';

export interface KnowledgeFiltersBarProps {
  value: KnowledgeFilterState;
  onChange: (next: KnowledgeFilterState) => void;
}

interface Option {
  value: string;
  label: string;
}

function FilterSelect(props: { id: string; label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger id={props.id} className="h-9 w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const PUBLISHED_OPTIONS: Option[] = [
  { value: ALL, label: 'Published and unpublished' },
  { value: 'published', label: 'Published only' },
  { value: 'unpublished', label: 'Unpublished only' },
];

/** Unit, reason (failure) code, published state and search text (debounced); every filter is applied by the server. */
export function KnowledgeFiltersBar({ value, onChange }: KnowledgeFiltersBarProps) {
  const { units } = useUnitNames();
  const reasons = useCodeLibrary('reason-codes');
  const reasonOptions = useMemo(
    () => [{ value: ALL, label: 'All reason codes' }, ...flattenPages(reasons.data?.pages).map((code) => ({ value: code.id, label: `${code.code} · ${code.name}` }))],
    [reasons.data],
  );
  const unitOptions = [{ value: ALL, label: 'All units' }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))];
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="knowledge-filters">
      <FilterSelect id="knowledge-unit" label="Unit" value={value.unitId} options={unitOptions} onChange={(unitId) => onChange({ ...value, unitId })} />
      <FilterSelect id="knowledge-reason" label="Reason code" value={value.reasonCodeId} options={reasonOptions} onChange={(reasonCodeId) => onChange({ ...value, reasonCodeId })} />
      <FilterSelect
        id="knowledge-published"
        label="State"
        value={value.published}
        options={PUBLISHED_OPTIONS}
        onChange={(published) => onChange({ ...value, published: published as PublishedChoice })}
      />
      <div className={FIELD_CLASS}>
        <p className="text-sm font-medium leading-none" aria-hidden="true">
          Search
        </p>
        <DebouncedSearchInput
          className="sm:w-72 [&_input]:h-9"
          label="Search knowledge entries"
          placeholder="Search title, root cause or problem"
          value={value.text}
          onChange={(text) => onChange({ ...value, text })}
        />
      </div>
    </div>
  );
}
