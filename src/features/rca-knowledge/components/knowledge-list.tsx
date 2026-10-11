import { useRcaKnowledgeList, type RcaKnowledgeFilters } from '@/api/v2/queries/rca-knowledge';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { QualityBadge } from './quality-score';

export interface KnowledgeListProps {
  filters: RcaKnowledgeFilters;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function EntryRow({ entry, selected, onSelect }: { entry: RcaKnowledgeView; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-current={selected}
      className={`w-full px-3 py-2 text-left hover:bg-muted ${selected ? 'bg-muted' : ''}`}
      onClick={onSelect}
    >
      <span className="block font-medium">{entry.title}</span>
      {entry.rootCause && <span className="block truncate text-xs text-muted-foreground">{entry.rootCause}</span>}
      <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <QualityBadge score={entry.qualityScore} />
        <Badge variant={entry.isPublished ? 'default' : 'outline'}>{entry.isPublished ? 'Published' : 'Unpublished'}</Badge>
        {entry.unitName ?? (entry.unitId ? null : 'Tenant-wide')}
        {entry.assetName && <span>· {entry.assetName}</span>}
        <span>· {entry.helpfulCount} helpful</span>
      </span>
    </button>
  );
}

/** One server page at a time (25 entries, keyset cursor); "Load more" asks for the next page. */
export function KnowledgeList({ filters, selectedId, onSelect }: KnowledgeListProps) {
  const list = useRcaKnowledgeList(filters);
  return (
    <section aria-label="Knowledge entries" className="space-y-2">
      <DataState state={dataStateOf(list, { isEmpty: list.items.length === 0 })} error={list.error} onRetry={() => list.refetch()}>
        <ul className="divide-y rounded border" data-testid="knowledge-list">
          {list.items.map((entry) => (
            <li key={entry.id}>
              <EntryRow entry={entry} selected={entry.id === selectedId} onSelect={() => onSelect(entry.id)} />
            </li>
          ))}
        </ul>
        {list.hasNextPage && (
          <Button variant="outline" size="sm" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Load more
          </Button>
        )}
      </DataState>
    </section>
  );
}
