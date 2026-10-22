/** The lists of Setup › Profiles & rates (`/setup/profiles?tab=`). */
export type ProfilesAreaTab = 'profiles' | 'transitions' | 'streams';

export const PROFILES_PAGE = '/setup/profiles';

/** The address of a tab; the chosen unit goes along (every tab filters by unit). */
export function profilesTabPath(tab: ProfilesAreaTab, unitId = ''): string {
  const query = new URLSearchParams();
  if (tab !== 'profiles') query.set('tab', tab);
  if (unitId) query.set('unitId', unitId);
  const text = query.toString();
  return `${PROFILES_PAGE}${text ? `?${text}` : ''}`;
}
