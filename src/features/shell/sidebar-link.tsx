import { analysisHref } from '@/features/analysis-navigation/analysis-pages';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { preloadRoute } from '@/app/routes';
import { sidebarNameOf, type NavigationItem } from '@/features/auth/navigation-items';
import { cn } from '@/lib/utils';

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
function accessibleNameOf(item: NavigationItem, collapsed: boolean): string | undefined {
  if (collapsed) return item.name;
  if (!item.label || item.label === item.name) return undefined;
  return item.name.toLowerCase().includes(item.label.toLowerCase()) ? item.name : undefined;
}

/**
 * One menu link. On the collapsed rail it is icon-only, so it carries `aria-label` (its accessible
 * name) and a tooltip; expanded, long labels wrap to two lines with the full name as `title` (UX audit
 * B-1). Hover or focus starts downloading the page chunk.
 */
export function SidebarLink({ item, collapsed, active, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;
  const location = useLocation();
  const link = (
    <NavLink
      to={analysisHref(item.href, location)}
      end={item.exact}
      onClick={onNavigate}
      aria-label={accessibleNameOf(item, collapsed)}
      title={collapsed ? undefined : item.name}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => preloadRoute(item.href)}
      onFocus={() => preloadRoute(item.href)}
      className={cn(
        'flex items-center gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
        active
          ? 'relative bg-sidebar-active-bg text-sidebar-active-fg before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-active-bar'
          : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {!collapsed && <span className="line-clamp-2 min-w-0 break-words leading-snug">{sidebarNameOf(item)}</span>}
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
