import { useState } from 'react';
import { useRcaCases, type RcaCaseFilters } from '@/api/v2/queries/rca-cases';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';

export interface SearchContext {
  assetId: string | null;
  reasonCodeId: string | null;
  /** the event's interval; the window filter widens it by a week on both sides */
  from: string;
  to: string;
}

const WEEK_MS = 7 * 86_400_000;
const shift = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

export interface CaseSearchProps {
  context: SearchContext;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** §16.2 existing-case search: by asset, reason and time window of linked events, and title — on the server. */
export function CaseSearch({ context, selectedId, onSelect }: CaseSearchProps) {
  const [byAsset, setByAsset] = useState(Boolean(context.assetId));
  const [byReason, setByReason] = useState(false);
  const [byWindow, setByWindow] = useState(false);
  const [q, setQ] = useState('');
  const filters: RcaCaseFilters = {
    assetId: byAsset ? (context.assetId ?? undefined) : undefined,
    reasonCodeId: byReason ? (context.reasonCodeId ?? undefined) : undefined,
    from: byWindow ? shift(context.from, -WEEK_MS) : undefined,
    to: byWindow ? shift(context.to, WEEK_MS) : undefined,
    q: q || undefined,
  };
  const cases = useRcaCases(filters);
  return (
    <div className="space-y-2" data-testid="case-search">
      <div className="flex flex-wrap gap-3 text-sm">
        <Toggle id="by-asset" label="Same asset" checked={byAsset} disabled={!context.assetId} onChange={setByAsset} />
        <Toggle id="by-reason" label="Same reason" checked={byReason} disabled={!context.reasonCodeId} onChange={setByReason} />
        <Toggle id="by-window" label="Within ±7 days" checked={byWindow} onChange={setByWindow} />
      </div>
      <DebouncedSearchInput label="Search case titles" value={q} onChange={(text) => setQ(text.trim())} />
      <DataState state={dataStateOf(cases, { isEmpty: cases.items.length === 0 })} error={cases.error} detail="No case matches.">
        <ul className="divide-y rounded border" role="listbox" aria-label="Existing cases">
          {cases.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === selectedId}
                className={`w-full px-2 py-1 text-left text-sm hover:bg-muted ${item.id === selectedId ? 'bg-muted font-medium' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {item.title} <span className="text-xs text-muted-foreground">· {item.status ?? 'Draft'} · {item.priority ?? 'Medium'}</span>
              </button>
            </li>
          ))}
        </ul>
        {cases.hasNextPage && (
          <Button variant="outline" size="sm" className="mt-2" disabled={cases.isFetchingNextPage} onClick={() => void cases.fetchNextPage()}>
            Show more cases
          </Button>
        )}
      </DataState>
    </div>
  );
}

function Toggle(props: { id: string; label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Checkbox id={props.id} checked={props.checked} disabled={props.disabled} onCheckedChange={(value) => props.onChange(value === true)} />
      <Label htmlFor={props.id}>{props.label}</Label>
    </div>
  );
}
