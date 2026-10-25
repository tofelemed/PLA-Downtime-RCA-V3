import type { NavGroup } from '@/features/auth/navigation-items';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SidebarLink } from './sidebar-link';

export interface SidebarGroupProps {
  group: NavGroup;
  /** href of the one highlighted item of the whole menu (longest match), if any */
  activeHref: string | undefined;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  /** called after one of its links is followed (closes the drawer) */
  onNavigate?: () => void;
}

/**
 * One section of the sidebar. Expanded: a disclosure button (`aria-expanded`, `aria-controls`) over its
 * links; a closed section keeps its links in the DOM (`hidden`). Any section can be closed, the one
 * holding the current page too (the sidebar opens it again when the user moves to another section).
 * Collapsed rail: the links only, separated from the next section by a divider.
 */
export function SidebarGroup({ group, activeHref, collapsed, open, onToggle, onNavigate }: SidebarGroupProps) {
  const { section } = group;
  const shown = collapsed || open;
  const visible = railItems(group, activeHref, collapsed);
  const listId = `nav-section-${section.key}`;
  const holdsActive = group.items.some((item) => item.href === activeHref);
  const Chevron = shown ? UiIcon.chevronDown : UiIcon.chevronRight;
  return (
    <li className={cn(collapsed && 'border-t pt-2 first:border-t-0 first:pt-0')}>
      {!collapsed && (
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={listId}
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            holdsActive ? 'bg-sidebar-active-bg text-sidebar-active-fg' : 'text-muted-foreground hover:text-sidebar-foreground',
          )}
        >
          <span className="flex-1 text-left">{section.label}</span>
          <Chevron className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <ul id={listId} hidden={!shown} aria-label={collapsed ? section.label : undefined} className={cn('space-y-1', !collapsed && 'mt-1')}>
        {visible.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} collapsed={collapsed} active={item.href === activeHref} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function railItems(group: NavGroup, activeHref: string | undefined, collapsed: boolean) {
  if (!collapsed || (group.section.key !== 'downtime' && group.section.key !== 'pla')) return group.items;
  return [group.items.find((item) => item.href === activeHref) ?? group.items[0]].filter(Boolean);
}
