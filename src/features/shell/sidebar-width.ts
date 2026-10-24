/**
 * The sidebar's width, shared by the sidebar and the header's brand cell so the header partition
 * lines up with the sidebar edge and the hierarchy with the page content.
 */
export const SIDEBAR_WIDTH_CLASS = { expanded: 'w-52', collapsed: 'w-16' } as const;

export const sidebarWidthClass = (collapsed: boolean): string =>
  collapsed ? SIDEBAR_WIDTH_CLASS.collapsed : SIDEBAR_WIDTH_CLASS.expanded;

/** The page content's left padding (`main` in Layout), repeated before the header's hierarchy. */
export const CONTENT_INSET_CLASS = 'pl-4 md:pl-6';
