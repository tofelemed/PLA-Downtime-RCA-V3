import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { downloadText } from '@/features/rca/model/case-export';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { KnowledgeFiltersBar } from './components/knowledge-filters-bar';
import { KnowledgeTable } from './components/knowledge-table';
import { SharedLessons } from './components/shared-lessons';
import { fetchKnowledgeForExport, knowledgeCsv } from './model/knowledge-export';
import { filtersFromParams, paramsFromFilters, toKnowledgeQuery, type KnowledgeFilterState } from './model/knowledge-filters';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

function ExportButton({ filters }: { filters: KnowledgeFilterState }) {
  const { number } = useNumberFormat();
  const [state, setState] = useState<{ busy: boolean; error: unknown; note: string | null }>({ busy: false, error: null, note: null });
  const run = async () => {
    setState({ busy: true, error: null, note: null });
    try {
      const { entries, truncated } = await fetchKnowledgeForExport(toKnowledgeQuery(filters, filters.text));
      downloadText(knowledgeCsv(entries), 'rca-knowledge-base.csv', 'text/csv');
      setState({ busy: false, error: null, note: truncated ? `Exported the first ${number(entries.length)} entries; narrow the filters for the rest.` : null });
    } catch (error) {
      setState({ busy: false, error, note: null });
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={state.busy} onClick={() => void run()}>
        <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
        {state.busy ? 'Exporting…' : 'Export CSV'}
      </Button>
      {state.note && <p role="status" className="text-xs text-muted-foreground">{state.note}</p>}
      {state.error ? <FriendlyErrorAlert error={state.error} /> : null}
    </div>
  );
}

function KnowledgeScreen() {
  const [params, setParams] = useSearchParams();
  const legacy = params.get('entry');
  const filters = filtersFromParams(params);
  if (legacy) return <Navigate to={`/rca-knowledge-base/${encodeURIComponent(legacy)}`} replace />;
  const setFilters = (next: KnowledgeFilterState) => setParams(paramsFromFilters(next), { replace: true });
  return (
    <Page width="wide">
      <PageHeader
        title="RCA knowledge base"
        description="Learning from closed RCA cases of this plant. Entries are written when a case closes; a reliability engineer or manager publishes them."
        actions={<ExportButton filters={filters} />}
      />
      <Section title="Entries">
        <div className="space-y-3" data-testid="rca-knowledge-v2">
          <KnowledgeFiltersBar value={filters} onChange={setFilters} />
          <KnowledgeTable
            filters={toKnowledgeQuery(filters, filters.text)}
            empty={{
              title: 'No entries',
              text: 'No entry matches these filters. Entries appear when RCA cases close.',
              action: (
                <Button variant="outline" size="sm" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              ),
            }}
          />
        </div>
      </Section>
      <Section
        title="From other plants"
        description="Lessons other plants of your organization shared. Check the fit (process, operating envelope, design) and use your own change control before copying a change."
        collapsible
        defaultOpen={false}
      >
        <SharedLessons />
      </Section>
    </Page>
  );
}

/** `/rca-knowledge-base`: entries searched and paged by the server (20 per page), filters in the URL. */
export function RcaKnowledgePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its RCA knowledge base." />;
  return <KnowledgeScreen />;
}
