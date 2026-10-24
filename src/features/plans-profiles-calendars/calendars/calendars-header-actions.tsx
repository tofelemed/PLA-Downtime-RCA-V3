import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentAddress, withReturnTo } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { useUnitParam } from '../hooks/use-unit-param';

/**
 * Right of the Calendars & crews title: "New calendar version" of the chosen calendar (site or the unit in
 * `?unitId=`) for calendar writers, the Read-only note for viewers. The link carries this address (`?back=`).
 */
export function CalendarsHeaderActions() {
  const { canWriteCalendars } = useCapabilities();
  const [unitId] = useUnitParam();
  const here = useCurrentAddress();
  return (
    <>
      <ReadOnlyHint />
      {canWriteCalendars && (
        <Button asChild size="sm" className="whitespace-nowrap" data-testid="calendar-new">
          <Link to={withReturnTo(`/planning/calendars/new${unitId ? `?unitId=${unitId}` : ''}`, here)}>
            <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
            New calendar version
          </Link>
        </Button>
      )}
    </>
  );
}
