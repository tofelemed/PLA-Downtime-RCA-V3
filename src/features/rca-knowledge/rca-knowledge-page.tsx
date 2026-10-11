import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { useDebouncedValue } from '@/features/ux-kit/use-debounced-value';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { KnowledgeDetail } from './components/knowledge-detail';
import { KnowledgeFiltersBar } from './components/knowledge-filters-bar';
import { KnowledgeList } from './components/knowledge-list';
import { EMPTY_FILTERS, toKnowledgeQuery } from './model/knowledge-filters';

/**
 * RCA knowledge base on v2 (owner decision 2026-10-12, `v2.rca`): entries written when cases close,
 * searched and paged by the server, with the server's quality score, votes and publish control.
 */
export function RcaKnowledgePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to see its RCA knowledge base." />;
  return <KnowledgeScreen />;
}

function KnowledgeScreen() {
  const { timezone } = usePlantTimezone();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const q = useDebouncedValue(filters.text, 300);
  const selected = params.get('entry');
  return (
    <div className="space-y-4" data-testid="rca-knowledge-v2">
      <header>
        <h1 className="text-2xl font-bold">RCA Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">
          Learning from closed RCA cases of this plant. Entries are written when a case closes; a reliability engineer or
          manager publishes them.
        </p>
      </header>
      <KnowledgeFiltersBar value={filters} onChange={setFilters} />
      <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <KnowledgeList filters={toKnowledgeQuery(filters, q)} selectedId={selected} onSelect={(id) => setParams({ entry: id })} />
        {selected ? (
          <KnowledgeDetail key={selected} id={selected} timezone={timezone} />
        ) : (
          <p className="text-sm text-muted-foreground">Select an entry to read its root cause and recommendations.</p>
        )}
      </div>
    </div>
  );
}
