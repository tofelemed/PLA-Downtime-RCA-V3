import { lazy, Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DecisionBanners } from './components/decision-banners';
import { pageNameOf } from '@/features/auth/navigation-items';

const PlansTab = lazy(() => import('./plans/plans-tab').then((m) => ({ default: m.PlansTab })));
const ProfilesTab = lazy(() => import('./profiles/profiles-tab').then((m) => ({ default: m.ProfilesTab })));
const TransitionStandardsTab = lazy(() => import('./profiles/transition-standards-tab').then((m) => ({ default: m.TransitionStandardsTab })));
const UnitStreamsTab = lazy(() => import('./streams/unit-streams-tab').then((m) => ({ default: m.UnitStreamsTab })));
const CalendarsTab = lazy(() => import('./calendars/calendars-tab').then((m) => ({ default: m.CalendarsTab })));

const TABS = [
  { value: 'plans', label: 'Plans', Component: PlansTab },
  { value: 'profiles', label: 'Profiles & rates', Component: ProfilesTab },
  { value: 'transitions', label: 'Grade transitions', Component: TransitionStandardsTab },
  { value: 'streams', label: 'Streams', Component: UnitStreamsTab },
  { value: 'calendars', label: 'Calendars & crews', Component: CalendarsTab },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/**
 * The three pages of these tabs (owner 21 Oct 2026): plans stay under Production, profiles and calendars are
 * set up once and live under Setup.
 */
const VIEWS = {
  plans: { path: '/planning', tabs: ['plans'], title: pageNameOf('/planning'), description: 'Versioned production plans and the period accounting they drive.' },
  profiles: { path: '/setup/profiles', tabs: ['profiles', 'transitions', 'streams'], title: pageNameOf('/setup/profiles'), description: 'Unit and product profiles with their production rates, grade transitions and streams.' },
  calendars: { path: '/setup/calendars', tabs: ['calendars'], title: pageNameOf('/setup/calendars'), description: 'The shift calendar the plant runs on, its crews and rotations.' },
} satisfies Record<string, { path: string; tabs: readonly TabValue[]; title: string; description: string }>;

export type PlanningView = keyof typeof VIEWS;

/** The page a tab lives on (old `/planning?tab=calendars` links are sent there). */
function viewOfTab(tab: string | null): PlanningView | null {
  const found = (Object.keys(VIEWS) as PlanningView[]).find((view) => (VIEWS[view].tabs as readonly string[]).includes(tab ?? ''));
  return found ?? null;
}

/**
 * Production plans, or the profiles / calendars set up for them: capability and schedule as versioned master
 * data, previews from the server before every approval. The tab is in the URL (`?tab=`); records, forms and
 * editors are sub-pages (`/planning/plans/…`, `/planning/profiles/…`, `/planning/calendars/…`).
 */
export function PlanningPage({ view = 'plans' }: { view?: PlanningView }) {
  const tenantId = useV2TenantId();
  const { selection } = usePlantSelection();
  const zone = usePlantTimezone();
  const [params, setParams] = useSearchParams();
  const page = VIEWS[view];
  const tabs = TABS.filter((t) => (page.tabs as readonly string[]).includes(t.value));
  const wanted = params.get('tab');
  const home = viewOfTab(wanted);
  if (home && home !== view) {
    const rest = new URLSearchParams(params);
    if (VIEWS[home].tabs.length === 1) rest.delete('tab');
    const query = rest.toString();
    return <Navigate to={`${VIEWS[home].path}${query ? `?${query}` : ''}`} replace />;
  }
  const tab = tabs.some((t) => t.value === wanted) ? (wanted as string) : tabs[0].value;
  if (!tenantId) return <DataState state="no-permission" detail={`Choose a plant to manage its ${page.title.toLowerCase()}.`} />;
  return (
    <Page width="wide">
      <div data-testid="planning-page" className="space-y-6">
        <PageHeader
          title={page.title}
          description={page.description}
          meta={<ScopeHeader scopeLabel={selection?.tenant?.name ?? 'Plant'} timezone={zone.timezone} timezoneIsFallback={zone.source === 'utc-fallback'} />}
        />
        <DecisionBanners tab={tab} />
        <Tabs value={tab} onValueChange={(next) => setParams({ tab: next }, { replace: true })}>
          <TabsList className={tabs.length > 1 ? 'h-auto flex-wrap' : 'sr-only'}>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(({ value, Component }) => (
            <TabsContent key={value} value={value} className="pt-3">
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>{tab === value && <Component />}</Suspense>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Page>
  );
}

/** Route element of `/setup/profiles` (Setup → Profiles & rates). */
export const SetupProfilesPage = () => <PlanningPage view="profiles" />;
/** Route element of `/setup/calendars` (Setup → Calendars & crews). */
export const SetupCalendarsPage = () => <PlanningPage view="calendars" />;
