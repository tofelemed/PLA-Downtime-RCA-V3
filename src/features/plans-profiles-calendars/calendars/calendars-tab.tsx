import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCalendarVersions } from '@/api/v2/queries/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import type { CalendarScope } from '../hooks/use-calendar-editor';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { calendarVersionPath } from '../model/calendar-paths';
import { CalendarVersionList } from './calendar-version-list';
import { CrewRotationEditor } from './crew-rotation-editor';

/**
 * Calendars: versions of the site calendar or of a unit override (a row opens the editor at
 * `/planning/calendars/:versionId[/edit]`), a new version at `/planning/calendars/new`, and the crews.
 */
export function CalendarsTab() {
  const { canWriteCalendars } = useCapabilities();
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const [unitId, setUnitId] = useState('');
  const scope: CalendarScope = unitId ? { unitId } : refs.defaultSiteId ? { siteId: refs.defaultSiteId } : {};
  const versions = useCalendarVersions(scope, Boolean(unitId || refs.defaultSiteId));
  const items = flattenPages(versions.data?.pages).filter((v) => (unitId ? v.unitId === unitId : v.unitId === null));
  return (
    <div className="space-y-6" data-testid="calendars-tab">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72">
            <FormField id="calendarScope" label="Calendar of" hint="The site calendar, or a unit override (the newest published version in force wins)">
              <NativeSelect id="calendarScope" value={unitId} options={refs.unitOptions} placeholder="Site (default)" onChange={setUnitId} />
            </FormField>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ReadOnlyHint />
            {canWriteCalendars && (
              <Button asChild size="sm" data-testid="calendar-new">
                <Link to={`/planning/calendars/new${unitId ? `?unitId=${unitId}` : ''}`}>
                  <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
                  New calendar version
                </Link>
              </Button>
            )}
          </div>
        </div>
        <CalendarVersionList
          versions={items}
          status={{ isLoading: versions.isLoading, isError: versions.isError, error: versions.error, onRetry: () => void versions.refetch() }}
          onOpen={(v) => navigate(calendarVersionPath(v, canWriteCalendars))}
        />
        {versions.hasNextPage && (
          <Button size="sm" variant="ghost" onClick={() => void versions.fetchNextPage()} disabled={versions.isFetchingNextPage}>
            Load older versions
          </Button>
        )}
      </div>
      <CrewRotationEditor siteId={refs.defaultSiteId ?? undefined} timezone={refs.timezone} />
    </div>
  );
}
