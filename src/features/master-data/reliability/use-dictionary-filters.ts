import type { DictionaryListFilters } from '@/api/v2/queries/failure-dictionary';
import { DICTIONARY_KIND_LABELS, type DictionaryKind } from '@/api/v2/types/failure-dictionary';
import { useSearchParam } from '@/features/plans-profiles-calendars/hooks/use-unit-param';

const isKind = (value: string): value is DictionaryKind => Object.keys(DICTIONARY_KIND_LABELS).includes(value);

export interface DictionaryFilterState {
  filters: Required<DictionaryListFilters>;
  setQ: (q: string) => void;
  setKind: (kind: string) => void;
  setEquipmentClass: (code: string) => void;
}

/** Search, list and equipment class of the dictionary table in the URL (`?q=&kind=&class=`), so Back keeps them. */
export function useDictionaryFilters(): DictionaryFilterState {
  const [q, setQ] = useSearchParam('q');
  const [kind, setKind] = useSearchParam('kind');
  const [equipmentClass, setEquipmentClass] = useSearchParam('class');
  return { filters: { q, kind: isKind(kind) ? kind : '', equipmentClass }, setQ, setKind, setEquipmentClass };
}
