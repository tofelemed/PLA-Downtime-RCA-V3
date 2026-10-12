import type { ReactNode } from 'react';
import { StatusIcon, UiIcon, type AppIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

export interface TreeRowProps {
  /** nesting depth, 0 = organisation */
  level: number;
  icon: AppIcon;
  label: string;
  selected: boolean;
  /** has children that can be shown */
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  children?: ReactNode;
}

/**
 * One node of the plant tree: an expand button (when the node has children) and a select button, both
 * real buttons so the whole tree works with Tab / Enter / Space (WCAG 2.1.1).
 */
export function TreeRow({ level, icon: Icon, label, selected, expandable, expanded, onToggle, onSelect, children }: TreeRowProps) {
  const Chevron = expanded ? UiIcon.chevronDown : UiIcon.chevronRight;
  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: level * 16 }}>
        {expandable ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            onClick={onToggle}
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="w-6" aria-hidden />
        )}
        <button
          type="button"
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected && 'bg-primary/10 font-semibold',
          )}
          onClick={onSelect}
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{label}</span>
          {selected && <StatusIcon.selected className="ml-auto h-4 w-4 text-primary" aria-label="Selected" />}
        </button>
      </div>
      {expanded && children ? <ul>{children}</ul> : null}
    </li>
  );
}
