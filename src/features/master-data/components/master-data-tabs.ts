import type { AreaTab } from '@/features/ux-kit/page-layout';
import type { MasterDataSection } from './master-data-sections';

/** Codes & rules is one page with two lists (`?tab=rules`); in the area's tab row they are two tabs. */
export const CODES_PAGE_PATH = '/master-data/codes-rules';
export const RULES_TAB_PATH = `${CODES_PAGE_PATH}?tab=rules`;

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** The tabs a section shows in the area's tab row (Codes & rules: Code libraries · Rules). */
function tabsOfSection(section: MasterDataSection): AreaTab[] {
  if (section.to !== CODES_PAGE_PATH) return [{ key: section.to, label: section.label, to: section.to }];
  return [
    { key: CODES_PAGE_PATH, label: 'Code libraries', to: CODES_PAGE_PATH, testId: 'tab-codes' },
    { key: RULES_TAB_PATH, label: 'Rules', to: RULES_TAB_PATH, testId: 'tab-rules' },
  ];
}

/** The tab row of a group's sections, in menu order. */
export function masterDataTabs(sections: readonly MasterDataSection[]): AreaTab[] {
  return sections.flatMap(tabsOfSection);
}

/**
 * The tab a master-data address belongs to: its list page, or on a record / form page the list the record is
 * in (longest section match; rule pages and `?tab=rules` are the Rules tab). Null outside master data.
 */
export function currentMasterDataTab(sections: readonly MasterDataSection[], pathname: string, search: string): string | null {
  if (under(pathname, CODES_PAGE_PATH)) {
    const rules = pathname.startsWith(`${CODES_PAGE_PATH}/rules/`) || (pathname === CODES_PAGE_PATH && new URLSearchParams(search).get('tab') === 'rules');
    return rules ? RULES_TAB_PATH : CODES_PAGE_PATH;
  }
  const own = sections.filter((section) => (section.end ? pathname === section.to : under(pathname, section.to)));
  return own.sort((a, b) => b.to.length - a.to.length)[0]?.to ?? null;
}
