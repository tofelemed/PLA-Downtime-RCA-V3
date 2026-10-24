import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

export interface SidebarCollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** The footer toggle of the sidebar; its accessible name is exactly "Expand sidebar" / "Collapse sidebar". */
export function SidebarCollapseButton({ collapsed, onToggle }: SidebarCollapseButtonProps) {
  const ToggleIcon = collapsed ? UiIcon.expandSidebar : UiIcon.collapseSidebar;
  return (
    <div className={cn('flex border-t border-sidebar-border p-2', collapsed ? 'justify-center' : 'justify-end')}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ToggleIcon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
