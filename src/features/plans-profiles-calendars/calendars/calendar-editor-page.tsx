import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { useCalendarVersion } from '../hooks/use-calendar-reads';
import type { CalendarScope, PreviewCandidate } from '../hooks/use-calendar-editor';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { calendarVersionPath } from '../model/calendar-paths';
import { draftOf, newCalendarDraft, type CalendarDraft } from '../model/calendar-draft';
import { CalendarEditor } from './calendar-editor';
import { CalendarPreviewPanel } from './calendar-preview-panel';

const LIST = '/setup/calendars';
const BACK = { to: LIST, label: 'Calendars & crews' };

interface WorkspaceProps {
  version: CalendarVersionView | null;
  seed: CalendarDraft;
  scope: CalendarScope;
  refs: PlanningRefs;
}

/** Editor plus the server preview of the stored version or of the unsaved edits (a click, never on render). */
function Workspace({ version, seed, scope, refs }: WorkspaceProps) {
  const navigate = useNavigate();
  const { canWriteCalendars } = useCapabilities();
  const [preview, setPreview] = useState<{ candidate: PreviewCandidate | null; request: number }>({ candidate: null, request: 0 });
  return (
    <div className="space-y-6">
      <CalendarEditor
        key={version ? `${version.id}-${version.rowVersion}` : 'new'}
        version={version}
        seed={seed}
        scope={scope}
        displayTimezone={refs.timezone}
        onSaved={(saved) => navigate(calendarVersionPath(saved, canWriteCalendars), { replace: !version })}
        onNewFrom={(from) => navigate(`/planning/calendars/new?from=${from.id}`)}
        onPreview={(candidate) => setPreview((prev) => ({ candidate, request: prev.request + 1 }))}
      />
      <CalendarPreviewPanel candidate={preview.candidate} request={preview.request} unitOptions={refs.unitOptions} defaultUnitId={scope.unitId ?? ''} timezone={refs.timezone} />
    </div>
  );
}

const scopeText = (unitId: string | null, refs: PlanningRefs) => (unitId ? `Unit override · ${refs.unitName(unitId)}` : 'Site calendar');

/**
 * A stored version: `/planning/calendars/:versionId/edit` for a draft the user may edit, the read-only
 * `/planning/calendars/:versionId` otherwise (a published version); the wrong one of the two redirects.
 */
export function CalendarVersionPage() {
  const { versionId = null } = useParams();
  const { pathname, search } = useLocation();
  const { canWriteCalendars } = useCapabilities();
  const refs = usePlanningRefs();
  const version = useCalendarVersion(versionId);
  const state = dataStateOf(version);
  const shown = version.data;
  const canonical = shown ? calendarVersionPath(shown, canWriteCalendars) : null;
  if (canonical && canonical !== pathname) return <Navigate to={`${canonical}${search}`} replace />;
  return (
    <Page>
      <PageHeader title={shown ? `Calendar version ${shown.version}` : 'Calendar version'} description={shown ? scopeText(shown.unitId, refs) : undefined} back={BACK} />
      {state === 'ready' && shown ? (
        <Workspace version={shown} seed={draftOf(shown)} scope={shown.unitId ? { unitId: shown.unitId } : { siteId: shown.siteId }} refs={refs} />
      ) : (
        <DataState state={state} error={version.error} />
      )}
    </Page>
  );
}

/** `/planning/calendars/new` (`?unitId=` for a unit override, `?from=<versionId>` to start from a version). */
export function NewCalendarVersionPage() {
  const [params] = useSearchParams();
  const refs = usePlanningRefs();
  const fromId = params.get('from');
  const from = useCalendarVersion(fromId);
  const unitId = from.data?.unitId ?? params.get('unitId') ?? '';
  const scope: CalendarScope = unitId ? { unitId } : refs.defaultSiteId ? { siteId: refs.defaultSiteId } : {};
  const waiting = (fromId && !from.data) || refs.loading;
  const seed = from.data ? { ...draftOf(from.data), effectiveFrom: '' } : newCalendarDraft(refs.timezone);
  return (
    <Page>
      <PageHeader title="New calendar version" description={unitId ? `Unit override · ${refs.unitName(unitId)}` : 'Site calendar'} back={BACK} />
      {waiting ? <DataState state={from.isError ? 'error' : 'loading'} error={from.error} /> : <Workspace version={null} seed={seed} scope={scope} refs={refs} />}
    </Page>
  );
}
