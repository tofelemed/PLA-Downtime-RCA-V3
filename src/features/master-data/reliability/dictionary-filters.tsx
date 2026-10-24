import { DICTIONARY_KIND_LABELS, type DictionaryKind } from '@/api/v2/types/failure-dictionary';
import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { LabelledSearch } from '../components/labelled-search';
import type { DictionaryFilterState } from './use-dictionary-filters';

const KINDS = Object.keys(DICTIONARY_KIND_LABELS) as DictionaryKind[];

export interface DictionaryFiltersProps {
  state: DictionaryFilterState;
  /** equipment class codes in force */
  classes: readonly string[];
}

/** The filter row of the dictionary table (labels above, h-9); every choice goes to the server query. */
export function DictionaryFilters({ state, classes }: DictionaryFiltersProps) {
  const { filters } = state;
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="dictionary-filters">
      <LabelledSearch label="Search code or name" placeholder="Search code or name" value={filters.q} onChange={state.setQ} />
      <div className={FIELD_CLASS}>
        <Label htmlFor="dictionary-kind">List</Label>
        <select id="dictionary-kind" className={`${SELECT_CLASS} w-48`} value={filters.kind} onChange={(e) => state.setKind(e.target.value)}>
          <option value="">All lists</option>
          {KINDS.map((k) => <option key={k} value={k}>{DICTIONARY_KIND_LABELS[k]}</option>)}
        </select>
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="dictionary-class">Equipment class</Label>
        <select id="dictionary-class" className={`${SELECT_CLASS} w-44`} value={filters.equipmentClass} onChange={(e) => state.setEquipmentClass(e.target.value)}>
          <option value="">Every class</option>
          {classes.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>
    </div>
  );
}
