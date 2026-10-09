import { Link } from 'react-router-dom';
import { useFlag } from '@/api/v2/queries/feature-flags';

/** On the retained Production Plans screen: where versioned plans, previews and approvals live (flag on only). */
export function PlanningLinkBanner() {
  const flag = useFlag('v2.plansProfilesCalendars');
  if (!flag.enabled) return null;
  return (
    <p className="rounded-md border bg-muted p-2 text-sm" data-testid="planning-link-banner">
      Versioned plans with an exact per-shift preview, server approval and history are in{' '}
      <Link className="underline" to="/planning">
        Plans, profiles & calendars
      </Link>
      . Targets there come from approved rates and the published calendar — never from a default rate.
    </p>
  );
}
