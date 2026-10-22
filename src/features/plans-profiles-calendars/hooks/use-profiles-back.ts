import { useReturnTo } from '@/features/ux-kit/page-layout';
import { PROFILES_PAGE } from '../model/profiles-area';

export interface ProfilesBack {
  to: string;
  label: string;
  /** the unit the list was filtered by, for the tab row's links */
  unitId: string;
}

/**
 * Back target of a profile / rate-import sub-page: the Profiles & rates list as the user left it (its tab and
 * unit / product filters, handed over as `?back=`), else the list itself.
 */
export function useProfilesBack(): ProfilesBack {
  const to = useReturnTo(PROFILES_PAGE, [PROFILES_PAGE]);
  const unitId = new URLSearchParams(to.split('?')[1] ?? '').get('unitId') ?? '';
  return { to, label: 'Profiles & rates', unitId };
}
