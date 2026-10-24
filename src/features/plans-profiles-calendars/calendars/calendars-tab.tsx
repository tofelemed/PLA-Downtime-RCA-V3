import { useNavigate } from 'react-router-dom';
import { useCalendarVersionPage } from '@/api/v2/queries/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { useCurrentAddress, withReturnTo } from '@/features/ux-kit/page-layout';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '../components/native-select';
import { TableCard } from '../components/table-card';
import type { CalendarScope } from '../hooks/use-calendar-editor';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useUnitParam } from '../hooks/use-unit-param';
import { calendarVersionPath } from '../model/calendar-paths';
import { CalendarVersionList } from './calendar-version-list';
import { CrewRotationEditor } from './crew-rotation-editor';

const SCOPE_INFO = 'The site calendar, or a unit override: the newest published version in force wins.';

/**
 * Calendars: versions of the site calendar or of a unit override (a row opens the editor at
 * `/planning/calendars/:versionId[/edit]`), and the crews. "New calendar version" is beside the page title. The
 * unit is in the URL (`?unitId=`) and sub-page links carry this address (`?back=`), so Back returns to the same calendar.
 */
export function CalendarsTab() {
  const { canWriteCalendars } = useCapabilities();
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const [unitId, setUnitId] = useUnitParam();
  const here = useCurrentAddress();
  const scope: CalendarScope = unitId ? { unitId } : refs.defaultSiteId ? { siteId: refs.defaultSiteId } : {};
  // one calendar per list (the server leaves the site's unit overrides out), 20 versions per page
  const versions = useCalendarVersionPage(scope, Boolean(unitId || refs.defaultSiteId));
  return (
    <div className="space-y-4" data-testid="calendars-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className={`${FIELD_CLASS} w-72`}>
          <Label htmlFor="calendarScope">Calendar of</Label>
          <NativeSelect id="calendarScope" value={unitId} options={refs.unitOptions} placeholder="Site (default)" onChange={setUnitId} />
        </div>
      </div>
      <TableCard title="Calendar versions" info={SCOPE_INFO}>
        <CalendarVersionList
          versions={versions.rows}
          pager={versions.pager}
          status={versions.status}
          onOpen={(v) => navigate(withReturnTo(calendarVersionPath(v, canWriteCalendars), here))}
        />
      </TableCard>
      <CrewRotationEditor siteId={refs.defaultSiteId ?? undefined} timezone={refs.timezone} />
    </div>
  );
}
