import { useLocation } from 'react-router-dom';
import { useFeatureFlags } from '@/api/v2/queries/feature-flags';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { groupNavigationItems, NAVIGATION_FLAGS, visibleNavigationItems } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { NavStateApi } from '@/features/auth/use-nav-state';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SidebarGroup } from './sidebar-group';

/** `{flag: on}` for the flags the menu depends on (unknown / unreachable = off, decision C4). */
function useMenuFlags(): Partial<Record<FeatureFlagKey, boolean>> {
  const { data } = useFeatureFlags();
  return Object.fromEntries(
    NAVIGATION_FLAGS.map((key) => [key, data?.items.find((flag) => flag.key === key)?.enabled === true]),
  );
}

/**
 * The sidebar: capability-gated items (features/auth) grouped in collapsible sections; an icon rail
 * when collapsed. The toggle's accessible name is exactly "Expand sidebar" / "Collapse sidebar".
 */
export function AppSidebar({ nav }: { nav: NavStateApi }) {
  const capabilities = useCapabilities();
  const { pathname } = useLocation();
  const groups = groupNavigationItems(visibleNavigationItems(capabilities, useMenuFlags()));
  const ToggleIcon = nav.collapsed ? UiIcon.expandSidebar : UiIcon.collapseSidebar;
  return (
    <nav aria-label="Main menu" className="flex h-full min-h-0 flex-col">
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
      <ul className={cn('flex-1 space-y-3 overflow-y-auto py-3', nav.collapsed ? 'px-2' : 'px-3')}>
        {groups.map((group) => (
          <SidebarGroup
            key={group.section.key}
            group={group}
            pathname={pathname}
            collapsed={nav.collapsed}
            open={nav.isSectionOpen(group.section.key)}
            onToggle={() => nav.toggleSection(group.section.key)}
          />
        ))}
      </ul>
    </nav>
  );
}
