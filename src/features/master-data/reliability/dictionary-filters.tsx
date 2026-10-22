import { DICTIONARY_KIND_LABELS, type DictionaryKind } from '@/api/v2/types/failure-dictionary';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import type { DictionaryFilterState } from './use-dictionary-filters';

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const KINDS = Object.keys(DICTIONARY_KIND_LABELS) as DictionaryKind[];

export interface DictionaryFiltersProps {
  state: DictionaryFilterState;
  /** equipment class codes in force */
  classes: readonly string[];
}

/** The toolbar of the dictionary table; every choice goes to the server query. */
export function DictionaryFilters({ state, classes }: DictionaryFiltersProps) {
  const { filters } = state;
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="dictionary-filters">
      <DebouncedSearchInput value={filters.q} onChange={state.setQ} label="Search code or name" placeholder="Search code or name..." className="w-full max-w-xs" />
      <label className="flex items-center gap-2 text-sm">
        List
        <select aria-label="List" className={SELECT_CLASS} value={filters.kind} onChange={(e) => state.setKind(e.target.value)}>
          <option value="">All lists</option>
          {KINDS.map((k) => <option key={k} value={k}>{DICTIONARY_KIND_LABELS[k]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        Equipment class
        <select aria-label="Equipment class" className={SELECT_CLASS} value={filters.equipmentClass} onChange={(e) => state.setEquipmentClass(e.target.value)}>
          <option value="">Every class</option>
          {classes.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </label>
    </div>
  );
}
