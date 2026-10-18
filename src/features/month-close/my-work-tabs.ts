/** Tabs of "My work" (UX audit §5.7), kept in the URL as `?tab=` (Periods is the default and has none). */
export const MY_WORK_TABS = [
  { key: 'periods', label: 'Periods' },
  { key: 'rca-actions', label: 'RCA actions' },
  { key: 'tasks', label: 'Tasks' },
] as const;

export type MyWorkTab = (typeof MY_WORK_TABS)[number]['key'];

const DEFAULT_TAB: MyWorkTab = 'periods';

/** The tab a URL names; unknown or missing values open Periods. */
export function myWorkTabOf(value: string | null): MyWorkTab {
  return MY_WORK_TABS.find((tab) => tab.key === value)?.key ?? DEFAULT_TAB;
}

/** The query of a tab: the default tab keeps a clean URL. */
export function myWorkSearchOf(tab: MyWorkTab): Record<string, string> {
  return tab === DEFAULT_TAB ? {} : { tab };
}
