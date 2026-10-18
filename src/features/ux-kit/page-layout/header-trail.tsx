import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { UiIcon } from '@/lib/icons';
import { PageBreadcrumbs } from './page-breadcrumbs';
import { routeTrail, type BackTarget, type Crumb } from './route-trail';

export interface HeaderTrailProps {
  title: string;
  back?: BackTarget;
  /** explicit trail; `false` turns the automatic one off */
  breadcrumbs?: readonly Crumb[] | false;
}

function BackLink({ back }: { back: BackTarget }) {
  return (
    <Link to={back.to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
      {back.label}
    </Link>
  );
}

function AutoTrail({ title, back }: { title: string; back?: BackTarget }) {
  const { pathname } = useLocation();
  const trail = routeTrail(pathname, title, back);
  if (!trail) return back ? <BackLink back={back} /> : null;
  return (
    <>
      {trail.keepBack && back && <BackLink back={back} />}
      <PageBreadcrumbs items={trail.crumbs} />
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
  if (breadcrumbs) return <PageBreadcrumbs items={breadcrumbs} />;
  if (!inRouter) return null;
  if (breadcrumbs === false) return back ? <BackLink back={back} /> : null;
  return <AutoTrail title={title} back={back} />;
}
