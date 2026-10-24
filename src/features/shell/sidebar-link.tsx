import { analysisHref } from '@/features/analysis-navigation/analysis-pages';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { preloadRoute } from '@/app/routes';
import { sidebarNameOf, type NavigationItem } from '@/features/auth/navigation-items';
import { cn } from '@/lib/utils';
import { usePendingApprovalsCount } from './pending-approvals-badge';

export interface SidebarLinkProps {
  item: NavigationItem;
  collapsed: boolean;
  active: boolean;
  /** called after a click (the drawer closes on navigation) */
  onNavigate?: () => void;
}

/**
 * The rail is icon-only, so the link is named by `aria-label`. Expanded, a short label keeps the full
 * name only when the name contains it (WCAG 2.5.3 label in name); otherwise the visible label is the name.
 */
function accessibleNameOf(item: NavigationItem, collapsed: boolean, badge?: string): string | undefined {
  if (badge) return `${item.name}, ${badge} pending`;
  if (collapsed) return item.name;
  if (!item.label || item.label === item.name) return undefined;
  return item.name.toLowerCase().includes(item.label.toLowerCase()) ? item.name : undefined;
}

const APPROVALS_HREF = '/approvals';

/**
 * One menu link: the label only, or on the collapsed rail the icon only (named by `aria-label`, with a
 * tooltip). The approvals link carries the pending count.
 */
export function SidebarLink(props: SidebarLinkProps) {
  return props.item.href === APPROVALS_HREF ? <ApprovalsLink {...props} /> : <MenuLink {...props} />;
}

function ApprovalsLink(props: SidebarLinkProps) {
  return <MenuLink {...props} badge={usePendingApprovalsCount()} />;
}

/**
 * Expanded, long labels wrap to two lines with the full name as `title` (UX audit B-1). Hover or focus
 * starts downloading the page chunk.
 */
function MenuLink({ item, collapsed, active, onNavigate, badge }: SidebarLinkProps & { badge?: string }) {
  const Icon = item.icon;
  const location = useLocation();
  const link = (
    <NavLink
      to={analysisHref(item.href, location)}
      end={item.exact}
      onClick={onNavigate}
      aria-label={accessibleNameOf(item, collapsed, badge)}
      title={collapsed ? undefined : item.name}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => preloadRoute(item.href)}
      onFocus={() => preloadRoute(item.href)}
      className={cn(
        'relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
        active
          ? 'bg-sidebar-active-bg font-semibold text-sidebar-active-fg before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-active-bar'
          : 'text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      {collapsed && <Icon className="h-5 w-5 shrink-0" aria-hidden />}
      {!collapsed && <span className="line-clamp-2 min-w-0 flex-1 break-words leading-snug">{sidebarNameOf(item)}</span>}
      {badge && <span aria-hidden className={cn('shrink-0 rounded-full bg-warning px-1.5 text-xs font-semibold text-warning-foreground', collapsed && 'absolute right-0 top-0 -translate-y-1/4 translate-x-1/4')}>{badge}</span>}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground">{item.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}
