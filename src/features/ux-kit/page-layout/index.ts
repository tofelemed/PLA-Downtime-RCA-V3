/** Page layout kit: `Page` frame, `PageHeader` (single h1 + actions) and `Section` blocks. */
export { Page } from './page';
export type { PageProps, PageWidth } from './page';
export { PageHeader } from './page-header';
export type { PageHeaderProps } from './page-header';
export { PageBreadcrumbs } from './page-breadcrumbs';
export type { Crumb } from './route-trail';
export { Section } from './section';
export type { SectionProps } from './section';
export { useDocumentTitle } from './use-document-title';
export { APP_TITLE, useAppName, useSyncAppName } from './app-name';
export { AreaTabs } from './area-tabs';
export type { AreaTab, AreaTabsProps } from './area-tabs';
export { RETURN_PARAM, returnTargetOf, useCurrentAddress, useReturnTo, withReturnTo } from './return-to';
