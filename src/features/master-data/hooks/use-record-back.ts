import { useReturnTo } from '@/features/ux-kit/page-layout';
import type { RecordListLink } from './record-save-result';

/** Another page a record page may be opened from (a unit's asset list, the plant hierarchy). */
export interface RecordOrigin {
  prefix: string;
  label: string;
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);

/**
 * Back / Cancel target of a master-data record page: the page it was opened from when that page handed its
 * address over (`?back=`, only the list or one of `origins`), else the list.
 *
 * @example useRecordBack({ to: '/master-data/assets', label: 'Assets' }, [{ prefix: '/master-data/units', label: 'Production unit' }])
 */
export function useRecordBack(list: RecordListLink, origins: readonly RecordOrigin[]): RecordListLink {
  const to = useReturnTo(list.to, [list.to, ...origins.map((origin) => origin.prefix)]);
  const origin = origins.find((candidate) => under(to, candidate.prefix));
  return { to, label: origin?.label ?? list.label };
}
