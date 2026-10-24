/**
 * The sidebar's width, shared by the sidebar and the header's brand cell so the header partition
 * lines up with the sidebar edge and the hierarchy with the page content.
 */
export const SIDEBAR_WIDTH_CLASS = { expanded: 'w-52', collapsed: 'w-16' } as const;

export const sidebarWidthClass = (collapsed: boolean): string =>
  collapsed ? SIDEBAR_WIDTH_CLASS.collapsed : SIDEBAR_WIDTH_CLASS.expanded;

/**
 * Inset before the header's hierarchy: the page content's left padding (`main`: p-4 / md:p-6) minus the
 * hierarchy button's own `px-2`, so its first icon lines up with the page title.
 */
export const CONTENT_INSET_CLASS = 'pl-2 md:pl-4';
