import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { preloadRoute } from '@/app/routes';
import type { NavigationItem } from '@/features/auth/navigation-items';
import { cn } from '@/lib/utils';

export interface SidebarLinkProps {
  item: NavigationItem;
  collapsed: boolean;
  active: boolean;
}

/**
 * One menu link. On the collapsed rail it is icon-only, so it carries `aria-label` (its accessible
 * name) and a tooltip; hover or focus starts downloading the page chunk.
 */
export function SidebarLink({ item, collapsed, active }: SidebarLinkProps) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.href}
      aria-label={collapsed ? item.name : undefined}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => preloadRoute(item.href)}
      onFocus={() => preloadRoute(item.href)}
      className={cn(
        'flex items-center gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.name}</span>}
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
