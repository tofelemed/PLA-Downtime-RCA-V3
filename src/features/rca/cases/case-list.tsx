import { useState } from 'react';
import { useRcaCases } from '@/api/v2/queries/rca-cases';
import { RCA_STATUSES } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useDebouncedValue } from '@/features/ux-kit/use-debounced-value';
import { useUnitNames } from '../use-unit-names';

const ALL = 'all';

export interface CaseListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Cases of the caller's scope, newest first, searched on the server (title, status). */
export function CaseList({ selectedId, onSelect }: CaseListProps) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const q = useDebouncedValue(text.trim(), 300);
  const cases = useRcaCases({ q: q || undefined, status: status === ALL ? undefined : status });
  const { unitName } = useUnitNames();
  return (
    <aside className="space-y-2" aria-label="RCA cases">
      <Input placeholder="Search titles" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search case titles" />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger aria-label="Status filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {RCA_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DataState state={dataStateOf(cases, { isEmpty: cases.items.length === 0 })} error={cases.error} onRetry={() => cases.refetch()}>
        <ul className="divide-y rounded border" data-testid="case-list">
          {cases.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.id === selectedId}
                className={`w-full px-3 py-2 text-left hover:bg-muted ${item.id === selectedId ? 'bg-muted' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="block font-medium">{item.title}</span>
                <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">{item.status ?? '—'}</Badge>
                  <Badge variant="outline">{item.priority ?? '—'}</Badge>
                  {unitName(item.unitId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {cases.hasNextPage && (
          <Button variant="outline" size="sm" className="mt-2" disabled={cases.isFetchingNextPage} onClick={() => void cases.fetchNextPage()}>
            Load more
          </Button>
        )}
      </DataState>
    </aside>
  );
}
