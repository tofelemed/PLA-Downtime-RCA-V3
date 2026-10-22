import { AreaTabs, type AreaTab } from '@/features/ux-kit/page-layout';
import { profilesTabPath, type ProfilesAreaTab } from '../model/profiles-area';

const TABS: readonly { key: ProfilesAreaTab; label: string }[] = [
  { key: 'profiles', label: 'Profiles & rates' },
  { key: 'transitions', label: 'Grade transitions' },
  { key: 'streams', label: 'Streams' },
];

/**
 * The one tab row of Profiles & rates: Profiles & rates · Grade transitions · Streams, on the list page and on
 * the profile / import sub-pages (DECISIONS 2026-10-22).
 */
export function ProfilesAreaTabs({ current, unitId }: { current: ProfilesAreaTab; unitId?: string }) {
  const tabs: AreaTab[] = TABS.map((tab) => ({ key: tab.key, label: tab.label, to: profilesTabPath(tab.key, unitId), testId: `tab-${tab.key}` }));
  return <AreaTabs tabs={tabs} current={current} />;
}
