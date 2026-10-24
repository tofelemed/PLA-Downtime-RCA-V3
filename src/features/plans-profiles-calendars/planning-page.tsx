import { lazy, Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { DecisionInfo } from './components/decision-info';
import { decisionNoteOf } from './model/decision-notes';
import { CalendarsHeaderActions } from './calendars/calendars-header-actions';
import { ProfilesHeaderActions } from './profiles/profiles-header-actions';
import { ProfilesAreaTabs } from './components/profiles-area-tabs';
import { PlansHeaderActions } from './plans/plans-header-actions';
import { useUnitParam } from './hooks/use-unit-param';
import type { ProfilesAreaTab } from './model/profiles-area';
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
  plans: { path: '/planning', tabs: ['plans'], title: pageNameOf('/planning') },
  profiles: { path: '/setup/profiles', tabs: ['profiles', 'transitions', 'streams'], title: pageNameOf('/setup/profiles') },
  calendars: { path: '/setup/calendars', tabs: ['calendars'], title: pageNameOf('/setup/calendars') },
} satisfies Record<string, { path: string; tabs: readonly TabValue[]; title: string }>;

export type PlanningView = keyof typeof VIEWS;

/** The page a tab lives on (old `/planning?tab=calendars` links are sent there). */
function viewOfTab(tab: string | null): PlanningView | null {
  const found = (Object.keys(VIEWS) as PlanningView[]).find((view) => (VIEWS[view].tabs as readonly string[]).includes(tab ?? ''));
  return found ?? null;
}

/** The page's add / import buttons and the Read-only note, at the right of the title. */
function HeaderActions({ view, tab }: { view: PlanningView; tab: TabValue }) {
  if (view === 'plans') return <PlansHeaderActions />;
  if (view === 'calendars') return <CalendarsHeaderActions />;
  return <ProfilesHeaderActions tab={tab as ProfilesAreaTab} />;
}

/**
 * Production plans, or the profiles / calendars set up for them: capability and schedule as versioned master
 * data, previews from the server before every approval. The tab is in the URL (`?tab=`) and chosen in the area's
 * link row (no nested shadcn tabs, SETUP_UX_FIXES Phase 3); records, forms and editors are sub-pages
 * (`/planning/plans/…`, `/planning/profiles/…`, `/planning/calendars/…`).
 */
export function PlanningPage({ view = 'plans' }: { view?: PlanningView }) {
  const tenantId = useV2TenantId();
  const [params] = useSearchParams();
  const [unitId] = useUnitParam();
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
  const active = tabs.find((t) => t.value === wanted) ?? tabs[0];
  const tab = active.value;
  const note = decisionNoteOf(tab);
  if (!tenantId) return <DataState state="no-permission" detail={`Choose a plant to manage its ${page.title.toLowerCase()}.`} />;
  return (
    <Page width="wide">
      <div data-testid="planning-page" className="space-y-6">
        <PageHeader
          title={page.title}
          titleAside={note ? <DecisionInfo note={note} /> : undefined}
          actions={<HeaderActions view={view} tab={tab} />}
        />
        {view === 'profiles' && <ProfilesAreaTabs current={tab as ProfilesAreaTab} unitId={unitId} />}
        <div data-testid={`panel-${active.value}`}>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <active.Component />
          </Suspense>
        </div>
      </div>
    </Page>
  );
}

/** Route element of `/setup/profiles` (Setup → Profiles & rates). */
export const SetupProfilesPage = () => <PlanningPage view="profiles" />;
/** Route element of `/setup/calendars` (Setup → Calendars & crews). */
export const SetupCalendarsPage = () => <PlanningPage view="calendars" />;
