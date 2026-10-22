import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UiIcon } from '@/lib/icons';
import { useCrumbReach } from './crumb-reach';
import { PageBreadcrumbs } from './page-breadcrumbs';
import { dedupeCrumbs, isSetupPath, routeTrail, withReach, type BackTarget, type Crumb } from './route-trail';

export interface HeaderTrailProps {
  title: string;
  back?: BackTarget;
  /** explicit trail; `false` turns the automatic one off */
  breadcrumbs?: readonly Crumb[] | false;
}

/** A back link to a page the user cannot open is left out (QA_MASTERDATA L23). */
function BackLink({ back }: { back: BackTarget }) {
  const canReach = useCrumbReach();
  if (!canReach(back.to)) return null;
  return (
    <Link to={back.to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
      {back.label}
    </Link>
  );
}

/** SETUP_UX_FIXES Phase 3: the plain "← Back to <list>" button of a Setup sub-page, next to its trail. */
function BackButton({ back }: { back: BackTarget }) {
  const canReach = useCrumbReach();
  if (!canReach(back.to)) return null;
  return (
    <Button asChild variant="outline" size="sm" className="h-8">
      <Link to={back.to} data-testid="page-back">
        <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
        Back to {back.label}
      </Link>
    </Button>
  );
}

function AutoTrail({ title, back }: { title: string; back?: BackTarget }) {
  const { pathname } = useLocation();
  const canReach = useCrumbReach();
  const trail = routeTrail(pathname, title, back);
  if (!trail) return back ? <BackLink back={back} /> : null;
  return (
    <>
      {trail.keepBack && back && <BackLink back={back} />}
      <PageBreadcrumbs items={withReach(trail.crumbs, canReach)} />
    </>
  );
}

function RoutedTrail({ title, back, breadcrumbs }: HeaderTrailProps) {
  const { pathname } = useLocation();
  const canReach = useCrumbReach();
  const trail = breadcrumbs ? <PageBreadcrumbs items={withReach(dedupeCrumbs(breadcrumbs), canReach)} /> : null;
  if (back && isSetupPath(pathname)) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BackButton back={back} />
        {breadcrumbs === false ? null : (trail ?? <SetupTrail title={title} back={back} />)}
      </div>
    );
  }
  if (trail) return trail;
  if (breadcrumbs === false) return back ? <BackLink back={back} /> : null;
  return <AutoTrail title={title} back={back} />;
}

/** The automatic trail of a Setup sub-page (its back link is the button beside it). */
function SetupTrail({ title, back }: { title: string; back: BackTarget }) {
  const { pathname } = useLocation();
  const canReach = useCrumbReach();
  const trail = routeTrail(pathname, title, back);
  return trail ? <PageBreadcrumbs items={withReach(trail.crumbs, canReach)} /> : null;
}

/**
 * What sits above the page title: an explicit trail, else the automatic route trail (which takes the
 * page's back link as its parent step), else the plain back link. Setup sub-pages also show a visible
 * "Back to <list>" button. Outside a router (isolated component tests) only an explicit trail renders.
 */
export function HeaderTrail({ title, back, breadcrumbs }: HeaderTrailProps) {
  const inRouter = useInRouterContext();
  const canReach = useCrumbReach();
  if (!inRouter) return breadcrumbs ? <PageBreadcrumbs items={withReach(dedupeCrumbs(breadcrumbs), canReach)} /> : null;
  return <RoutedTrail title={title} back={back} breadcrumbs={breadcrumbs} />;
}
