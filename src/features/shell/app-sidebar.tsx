import { useLocation } from 'react-router-dom';
import { activeNavItem, groupNavigationItems, visibleNavigationItems } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { NavStateApi } from '@/features/auth/use-nav-state';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SidebarGroup } from './sidebar-group';
import { useMenuFlags } from './use-menu-flags';

/**
 * The sidebar: capability-gated items (features/auth) grouped in collapsible sections; an icon rail
 * when collapsed. The toggle's accessible name is exactly "Expand sidebar" / "Collapse sidebar". Below
 * 1024 px it is rendered inside the navigation drawer (`variant="drawer"`).
 */
export interface AppSidebarProps {
  nav: NavStateApi;
  /** `drawer`: always expanded, no collapse toggle (the drawer has its own close button) */
  variant?: 'sidebar' | 'drawer';
  /** called after a menu link is followed */
  onNavigate?: () => void;
}

export function AppSidebar({ nav, variant = 'sidebar', onNavigate }: AppSidebarProps) {
  const capabilities = useCapabilities();
  const { pathname } = useLocation();
  const visible = visibleNavigationItems(capabilities, useMenuFlags());
  const groups = groupNavigationItems(visible);
  const activeHref = activeNavItem(visible, pathname)?.href;
  const ToggleIcon = nav.collapsed ? UiIcon.expandSidebar : UiIcon.collapseSidebar;
  return (
    <nav aria-label="Main menu" className="flex h-full min-h-0 flex-col">
      {variant === 'sidebar' && (
        <div className={cn('flex border-b p-2', nav.collapsed ? 'justify-center' : 'justify-end')}>
          <button
            type="button"
            onClick={nav.toggleCollapsed}
            aria-label={nav.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!nav.collapsed}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ToggleIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <ul className={cn('flex-1 space-y-3 overflow-y-auto py-3', nav.collapsed ? 'px-2' : 'px-3')}>
        {groups.map((group) => (
          <SidebarGroup
            key={group.section.key}
            group={group}
            activeHref={activeHref}
            collapsed={nav.collapsed}
            open={nav.isSectionOpen(group.section.key)}
            onToggle={() => nav.toggleSection(group.section.key)}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}
