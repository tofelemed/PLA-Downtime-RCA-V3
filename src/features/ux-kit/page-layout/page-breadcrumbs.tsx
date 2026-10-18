import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import type { Crumb } from './route-trail';

const LINK_CLASS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A breadcrumb trail (`nav` "Breadcrumb"): every step but the last is a link; the last is the page. */
export function PageBreadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        {items.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.to && index < items.length - 1 ? (
                <BreadcrumbLink asChild className={LINK_CLASS}>
                  <Link to={crumb.to}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage role={undefined} aria-disabled={undefined}>
                  {crumb.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
