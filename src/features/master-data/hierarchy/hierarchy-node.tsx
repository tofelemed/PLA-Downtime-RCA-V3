import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { UiIcon, type AppIcon } from '@/lib/icons';

export interface HierarchyNodeProps {
  level: number;
  icon: AppIcon;
  label: string;
  /** what the node is, read out with its name ("Unit", "Asset") */
  kind: string;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** links / buttons on the node's row (open, add child) */
  actions?: ReactNode;
  badge?: string;
  children?: ReactNode;
}

/**
 * One row of the plant hierarchy: a disclosure button (`aria-expanded`) when it has children, the node's
 * name and its actions. Nested lists keep the structure for screen readers; everything is Tab-reachable.
 */
export function HierarchyNode({ level, icon: Icon, label, kind, expandable, expanded, onToggle, actions, badge, children }: HierarchyNodeProps) {
  const Chevron = expanded ? UiIcon.chevronDown : UiIcon.chevronRight;
  return (
    <li>
      <div className="flex min-h-9 items-center gap-1 rounded hover:bg-muted/50" style={{ paddingLeft: level * 20 }}>
        {expandable ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${kind} ${label}`}
            onClick={onToggle}
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="w-6" aria-hidden />
        )}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate text-sm">
          <span className="sr-only">{kind}: </span>
          {label}
        </span>
        {badge && (
          <Badge variant="outline" className="ml-1 text-xs">
            {badge}
          </Badge>
        )}
        {actions && <span className="ml-auto flex shrink-0 items-center gap-1 pr-1">{actions}</span>}
      </div>
      {expanded && children ? <ul>{children}</ul> : null}
    </li>
  );
}
