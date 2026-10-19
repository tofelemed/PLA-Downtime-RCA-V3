import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { UiIcon } from '@/lib/icons';
import { useCrumbReach } from './crumb-reach';
import { PageBreadcrumbs } from './page-breadcrumbs';
import { dedupeCrumbs, routeTrail, withReach, type BackTarget, type Crumb } from './route-trail';

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

/**
 * What sits above the page title: an explicit trail, else the automatic route trail (which takes the
 * page's back link as its parent step), else the plain back link. Outside a router (isolated component
 * tests) only an explicit trail renders.
 */
export function HeaderTrail({ title, back, breadcrumbs }: HeaderTrailProps) {
  const inRouter = useInRouterContext();
  const canReach = useCrumbReach();
  if (breadcrumbs) return <PageBreadcrumbs items={withReach(dedupeCrumbs(breadcrumbs), canReach)} />;
  if (!inRouter) return null;
  if (breadcrumbs === false) return back ? <BackLink back={back} /> : null;
  return <AutoTrail title={title} back={back} />;
}
