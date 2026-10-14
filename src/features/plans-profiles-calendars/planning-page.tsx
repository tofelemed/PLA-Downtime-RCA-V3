import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DecisionBanners } from './components/decision-banners';

const PlansTab = lazy(() => import('./plans/plans-tab').then((m) => ({ default: m.PlansTab })));
const ProfilesTab = lazy(() => import('./profiles/profiles-tab').then((m) => ({ default: m.ProfilesTab })));
const TransitionStandardsTab = lazy(() => import('./profiles/transition-standards-tab').then((m) => ({ default: m.TransitionStandardsTab })));
const CalendarsTab = lazy(() => import('./calendars/calendars-tab').then((m) => ({ default: m.CalendarsTab })));

const TABS = [
  { value: 'plans', label: 'Plans', Component: PlansTab },
  { value: 'profiles', label: 'Profiles & rates', Component: ProfilesTab },
  { value: 'transitions', label: 'Grade transitions', Component: TransitionStandardsTab },
  { value: 'calendars', label: 'Calendars & crews', Component: CalendarsTab },
] as const;

/**
 * Production plans, profiles and calendars: capability and schedule as versioned master data, previews
 * from the server before every approval. The tab is in the URL (`?tab=`); records, forms and editors are
 * sub-pages (`/planning/plans/…`, `/planning/profiles/…`, `/planning/calendars/…`).
 */
export function PlanningPage() {
  const tenantId = useV2TenantId();
  const { selection } = usePlantSelection();
  const zone = usePlantTimezone();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? (params.get('tab') as string) : 'plans';
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to manage its plans, profiles and calendars." />;
  return (
    <Page width="wide">
      <div data-testid="planning-page" className="space-y-6">
        <PageHeader
          title="Plans, profiles & calendars"
          description="Versioned production plans, the rates they use and the shift calendar they run on."
          meta={<ScopeHeader scopeLabel={selection?.tenant?.name ?? 'Plant'} timezone={zone.timezone} timezoneIsFallback={zone.source === 'utc-fallback'} />}
        />
        <DecisionBanners tab={tab} />
        <Tabs value={tab} onValueChange={(next) => setParams({ tab: next }, { replace: true })}>
          <TabsList className="h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map(({ value, Component }) => (
            <TabsContent key={value} value={value} className="pt-3">
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>{tab === value && <Component />}</Suspense>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Page>
  );
}
