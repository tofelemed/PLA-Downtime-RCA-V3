import { useMemo } from 'react';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnitNames } from '@/features/rca/use-unit-names';
import { ALL, type KnowledgeFilterState, type PublishedChoice } from '../model/knowledge-filters';

export interface KnowledgeFiltersBarProps {
  value: KnowledgeFilterState;
  onChange: (next: KnowledgeFilterState) => void;
}

interface Option {
  value: string;
  label: string;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const PUBLISHED_OPTIONS: Option[] = [
  { value: ALL, label: 'Published and unpublished' },
  { value: 'published', label: 'Published only' },
  { value: 'unpublished', label: 'Unpublished only' },
];

/** Search text, unit, reason (failure) code and published state; every filter is applied by the server. */
export function KnowledgeFiltersBar({ value, onChange }: KnowledgeFiltersBarProps) {
  const { units } = useUnitNames();
  const reasons = useCodeLibrary('reason-codes');
  const reasonOptions = useMemo(
    () => [{ value: ALL, label: 'All reason codes' }, ...flattenPages(reasons.data?.pages).map((code) => ({ value: code.id, label: `${code.code} · ${code.name}` }))],
    [reasons.data],
  );
  const unitOptions = [{ value: ALL, label: 'All units' }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))];
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" data-testid="knowledge-filters">
      <Input
        className="sm:w-72"
        placeholder="Search title, root cause or problem"
        aria-label="Search knowledge entries"
        value={value.text}
        onChange={(event) => onChange({ ...value, text: event.target.value })}
      />
      <FilterSelect label="Unit filter" value={value.unitId} options={unitOptions} onChange={(unitId) => onChange({ ...value, unitId })} />
      <FilterSelect label="Reason code filter" value={value.reasonCodeId} options={reasonOptions} onChange={(reasonCodeId) => onChange({ ...value, reasonCodeId })} />
      <FilterSelect
        label="Published filter"
        value={value.published}
        options={PUBLISHED_OPTIONS}
        onChange={(published) => onChange({ ...value, published: published as PublishedChoice })}
      />
    </div>
  );
}
