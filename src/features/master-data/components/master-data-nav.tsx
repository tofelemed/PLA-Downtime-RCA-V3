import { useLocation } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AreaTabs } from '@/features/ux-kit/page-layout';
import { masterDataGroupOf, visibleMasterDataSections } from './master-data-sections';
import { currentMasterDataTab, masterDataTabs } from './master-data-tabs';

/**
 * The pages of the current Setup entry the user may open, as one wrapping row of links ("Plant & equipment":
 * units, assets, products, hierarchy, plant flow; 21 Oct 2026). Shown on the list pages and on their record /
 * form sub-pages, with the list the record belongs to highlighted. Nothing when the entry has a single page.
 */
export function MasterDataNav() {
  const capabilities = useCapabilities();
  const { pathname, search } = useLocation();
  const group = masterDataGroupOf(pathname);
  const sections = visibleMasterDataSections(capabilities).filter((section) => section.group === group);
  return <AreaTabs tabs={masterDataTabs(sections)} current={currentMasterDataTab(sections, pathname, search)} />;
}
