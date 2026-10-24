import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { activeNavItem, groupNavigationItems, visibleNavigationItems } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { NavStateApi } from '@/features/auth/use-nav-state';
import { cn } from '@/lib/utils';
import { SidebarCollapseButton } from './sidebar-collapse-button';
import { SidebarGroup } from './sidebar-group';
import { useMenuFlags } from './use-menu-flags';

/**
 * The sidebar: capability-gated items (features/auth) grouped in
 * collapsible sections as labels only, the collapse toggle at the bottom; an icon rail when collapsed. Moving to a page of another section opens that section and closes the others
 * (`focusSection`); any section can still be opened or closed by hand. Below
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
  const active = activeNavItem(visible, pathname);
  const activeHref = active?.href;
  const activeSection = active?.section;
  const { focusSection } = nav;
  // accordion on navigation: moving to a page of another section opens it and closes the others
  useEffect(() => {
    if (activeSection) focusSection(activeSection);
  }, [activeSection, focusSection]);
  return (
    <nav aria-label="Main menu" className="flex h-full min-h-0 flex-col">
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
      {variant === 'sidebar' && <SidebarCollapseButton collapsed={nav.collapsed} onToggle={nav.toggleCollapsed} />}
    </nav>
  );
}
