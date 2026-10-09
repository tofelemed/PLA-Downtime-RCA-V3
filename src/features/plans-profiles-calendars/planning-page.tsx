import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DataState } from '@/features/ux-kit/data-state';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DecisionBanners } from './components/decision-banners';

const PlansTab = lazy(() => import('./plans/plans-tab').then((m) => ({ default: m.PlansTab })));
const ProfilesTab = lazy(() => import('./profiles/profiles-tab').then((m) => ({ default: m.ProfilesTab })));
const CalendarsTab = lazy(() => import('./calendars/calendars-tab').then((m) => ({ default: m.CalendarsTab })));

const TABS = [
  { value: 'plans', label: 'Plans', Component: PlansTab },
  { value: 'profiles', label: 'Profiles & rates', Component: ProfilesTab },
  { value: 'calendars', label: 'Calendars & crews', Component: CalendarsTab },
] as const;

/**
 * Plans, profiles and calendars on v2 (plan 3.4) behind `v2.plansProfilesCalendars`: capability and
 * schedule as versioned master data, previews from the server before every approval. The tab is in the
 * URL (`?tab=`), so a link opens the same view.
 */
export function PlanningPage() {
  const tenantId = useV2TenantId();
  const { selection } = usePlantSelection();
  const zone = usePlantTimezone();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? (params.get('tab') as string) : 'plans';
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to manage its plans, profiles and calendars." />;
  return (
    <div className="space-y-4" data-testid="planning-page">
      <div>
        <h1 className="text-2xl font-semibold">Plans, profiles & calendars</h1>
        <ScopeHeader scopeLabel={selection?.tenant?.name ?? 'Plant'} timezone={zone.timezone} timezoneIsFallback={zone.source === 'utc-fallback'} />
      </div>
      <DecisionBanners tab={tab} />
      <Tabs value={tab} onValueChange={(next) => setParams({ tab: next }, { replace: true })}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value}>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>{tab === value && <Component />}</Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
