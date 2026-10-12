import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { UiIcon } from '@/lib/icons';
import type { RcaCauseView, RecordStatusFilter } from '../api/master-data-types';
import { RCA_CAUSES } from '../api/record-resource';
import { useRecordLookup } from '../api/use-record-queries';
import { RecordStatusBadge } from '../components/record-status-badge';
import { CauseActions, type CauseAction } from './cause-actions';

export interface CauseNodeProps {
  cause: RcaCauseView;
  depth: number;
  status: RecordStatusFilter;
  canWrite: boolean;
  onAction: (cause: RcaCauseView, action: CauseAction) => void;
}

function SubCauses({ parentId, ...rest }: Omit<CauseNodeProps, 'cause'> & { parentId: string }) {
  const children = useRecordLookup<RcaCauseView>(RCA_CAUSES, { parentId, status: rest.status, sort: 'code' });
  if (children.isLoading) {
    return <li className="py-1 text-sm text-muted-foreground" style={{ paddingLeft: rest.depth * 20 + 28 }}>Loading sub-causes…</li>;
  }
  if (children.isError) {
    return <li className="py-1 text-sm text-destructive" style={{ paddingLeft: rest.depth * 20 + 28 }}>Could not load the sub-causes.</li>;
  }
  return (
    <>
      {children.items.map((child) => (
        <CauseNode key={child.id} cause={child} {...rest} />
      ))}
    </>
  );
}

/** One cause with its sub-causes, loaded when the node is expanded. */
export function CauseNode({ cause, depth, status, canWrite, onAction }: CauseNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? UiIcon.chevronDown : UiIcon.chevronRight;
  const expandable = cause.activeChildren > 0 || status !== 'active';
  return (
    <li>
      <div className="flex min-h-9 items-center gap-2 rounded hover:bg-muted/50" style={{ paddingLeft: depth * 20 }}>
        {expandable ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${cause.name}`}
            onClick={() => setExpanded((open) => !open)}
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="w-6" aria-hidden />
        )}
        <span className="text-xs text-muted-foreground">{cause.code}</span>
        <span className="min-w-0 truncate text-sm font-medium">{cause.name}</span>
        {cause.category && <Badge variant="outline" className="text-xs">{cause.category}</Badge>}
        {!cause.isActive && <RecordStatusBadge retired />}
        {canWrite && (
          <span className="ml-auto">
            <CauseActions cause={cause} onAction={onAction} />
          </span>
        )}
      </div>
      {expanded && (
        <ul>
          <SubCauses parentId={cause.id} depth={depth + 1} status={status} canWrite={canWrite} onAction={onAction} />
        </ul>
      )}
    </li>
  );
}
