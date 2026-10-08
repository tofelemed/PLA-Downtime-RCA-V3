import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { invalidReference, notFound } from './calendar-errors';

/**
 * Calendar writes and the unit scope (WF05). A site-wide calendar, crew or rotation regenerates shift
 * instances for every unit of the site, so callers whose grants stop at some units may only write
 * unit-specific calendar versions of those units.
 */
export function assertSiteWideWriter(
  context: RequestContext,
  tenantId: string,
): void {
  if (restrictedUnitIds(context, tenantId)) {
    throw new ForbiddenException({
      code: 'SITE_SCOPE_REQUIRED',
      message:
        'This change affects every unit of the site; a tenant- or site-wide grant is required',
    });
  }
}

/** New version: a unit-limited caller must name one of its units (422 otherwise, no existence leak). */
export function assertCreatableFor(
  context: RequestContext,
  tenantId: string,
  unitId: string | null | undefined,
): void {
  const allowed = restrictedUnitIds(context, tenantId);
  if (!allowed) return;
  if (!unitId) assertSiteWideWriter(context, tenantId);
  else if (!allowed.includes(unitId)) throw invalidReference('unitId', 'unit');
}

/** Existing version: outside the caller's units it is answered like an unknown id (404). */
export function assertWritableVersion(
  context: RequestContext,
  version: { tenantId: string; unitId: string | null },
): void {
  const allowed = restrictedUnitIds(context, version.tenantId);
  if (!allowed) return;
  if (!version.unitId || !allowed.includes(version.unitId)) {
    throw notFound('Calendar version');
  }
}
