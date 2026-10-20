import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { ActionQueueTab } from '../actions/action-queue-tab';
import { OwnerActionsScreen } from '../actions/owner-actions-screen';
import { actionFiltersFromParams, DEFAULT_ACTION_FILTERS, paramsFromActionFilters, type ActionQueueFilters } from '../model/action-queue-filters';
import { filtersFromParams, filtersOfChip, legacyRedirect, paramsFromFilters, type CaseListFilters } from '../model/case-filters';
import { RecommendedTab } from '../recommendations/recommended-tab';
import { CauseCodeFilterChip } from './cause-code-filter-chip';
import { CaseFiltersBar } from './case-filters-bar';
import { CaseSummary } from './case-summary';
import { CaseTable } from './case-table';

const RECOMMENDED = 'recommended';
const ACTIONS = 'actions';

const tabOf = (value: string | null) => (value === RECOMMENDED || value === ACTIONS ? value : 'cases');

function CasesSection({ filters, onChange, onClear }: { filters: CaseListFilters; onChange: (next: CaseListFilters) => void; onClear: () => void }) {
  return (
    <Section title="Investigations">
      <div className="space-y-3">
        <CaseFiltersBar value={filters} onChange={onChange} />
        {filters.causeCodeId && <CauseCodeFilterChip causeCodeId={filters.causeCodeId} onRemove={() => onChange({ ...filters, causeCodeId: undefined })} />}
        <CaseTable
          filters={filters}
          empty={{
            title: 'No investigations',
            text: 'No investigation matches these filters. Open one from an event in the Event Hub, or start a new investigation.',
            action: (
              <Button variant="outline" size="sm" onClick={onClear}>
                Clear filters
              </Button>
            ),
          }}
        />
      </div>
    </Section>
  );
}

function ListScreen() {
  const { canWriteRca } = useCapabilities();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const legacy = legacyRedirect(params);
  if (legacy) return <Navigate to={legacy} replace />;
  const tab = tabOf(params.get('tab'));
  const setFilters = (next: CaseListFilters) => setParams(paramsFromFilters(next), { replace: true });
  const setActionFilters = (next: ActionQueueFilters) => setParams(paramsFromActionFilters(next), { replace: true });
  const clear = () => setParams({}, { replace: true });
  const setTab = (next: string) => {
    if (next === ACTIONS) return setParams(paramsFromActionFilters(DEFAULT_ACTION_FILTERS), { replace: true });
    setParams(next === RECOMMENDED ? { tab: RECOMMENDED } : paramsFromFilters(filters), { replace: true });
  };
  const actions = canWriteRca ? (
    <Button asChild data-testid="new-case">
      <Link to="/rca/new">
        <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
        New investigation
      </Link>
    </Button>
  ) : (
    <ReadOnlyHint />
  );
  return (
    <div data-testid="rca-v2">
      <Page width="wide">
        <PageHeader
          title={pageNameOf('/rca')}
          description="Investigations of this plant. Triggers only recommend an investigation; a person opens and closes it."
          actions={actions}
          meta={<CaseSummary filters={filters} onPick={(chip) => setFilters(filtersOfChip(chip))} />}
        />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="cases" data-testid="tab-cases">
              Investigations
            </TabsTrigger>
            <TabsTrigger value={ACTIONS} data-testid="tab-action-queue">
              Actions
            </TabsTrigger>
            <TabsTrigger value={RECOMMENDED} data-testid="tab-recommended">
              Recommended
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cases">
            <CasesSection filters={filters} onChange={setFilters} onClear={clear} />
          </TabsContent>
          <TabsContent value={ACTIONS}>
            <Section title="Actions" description="Actions of the investigations you can see, earliest due date first; actions without a due date come last.">
              <ActionQueueTab filters={actionFiltersFromParams(params)} onChange={setActionFilters} />
            </Section>
          </TabsContent>
          <TabsContent value={RECOMMENDED}>
            <Section title="Recommended investigations" description="Stops where an RCA trigger fired and no investigation is linked yet. Triggers only recommend; a person decides.">
              <RecommendedTab />
            </Section>
          </TabsContent>
        </Tabs>
      </Page>
    </div>
  );
}

/** `/rca`: the investigations (search, status, priority, target-date, open and cause-code filters; 20 per page), the actions (`?tab=actions`) and open recommendations. */
export function RcaListPage() {
  const tenantId = useV2TenantId();
  const { canViewAnalysis } = useCapabilities();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its investigations." />;
  return canViewAnalysis ? <ListScreen /> : <OwnerActionsScreen />;
}
