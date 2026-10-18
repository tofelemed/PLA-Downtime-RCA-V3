import { isNavItemActive, type NavGroup } from '@/features/auth/navigation-items';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SidebarLink } from './sidebar-link';

export interface SidebarGroupProps {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * One section of the sidebar. Expanded: a disclosure button (`aria-expanded`, `aria-controls`) over its
 * links; a closed section keeps its links in the DOM (`hidden`) and the section holding the current
 * page is always open. Collapsed rail: the links only, separated from the next section by a divider.
 */
export function SidebarGroup({ group, pathname, collapsed, open, onToggle }: SidebarGroupProps) {
  const { section, items } = group;
  const holdsActive = items.some((item) => isNavItemActive(item, pathname));
  const shown = collapsed || open || holdsActive;
  const visible = railItems(group, pathname, collapsed);
  const listId = `nav-section-${section.key}`;
  const Chevron = shown ? UiIcon.chevronDown : UiIcon.chevronRight;
  return (
    <li className={cn(collapsed && 'border-t pt-2 first:border-t-0 first:pt-0')}>
      {!collapsed && (
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={listId}
          disabled={holdsActive}
          onClick={onToggle}
          className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:text-muted-foreground"
        >
          <span className="flex-1 text-left">{section.label}</span>
          <Chevron className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <ul id={listId} hidden={!shown} aria-label={collapsed ? section.label : undefined} className="space-y-1">
        {visible.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} collapsed={collapsed} active={isNavItemActive(item, pathname)} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function railItems(group: NavGroup, pathname: string, collapsed: boolean) {
  if (!collapsed || (group.section.key !== 'downtime' && group.section.key !== 'pla')) return group.items;
  return [group.items.find((item) => isNavItemActive(item, pathname)) ?? group.items[0]].filter(Boolean);
}
