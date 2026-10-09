import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';

/**
 * Writes whose effect is tenant-wide (rate imports that may touch any unit, valuation rates not
 * bound to a profile) need a tenant- or site-wide grant; callers whose grants stop at some units
 * get 403 `TENANT_SCOPE_REQUIRED` (WF05).
 */
export function assertTenantWideWriter(
  context: RequestContext,
  tenantId: string,
): void {
  if (restrictedUnitIds(context, tenantId)) {
    throw new ForbiddenException({
      code: 'TENANT_SCOPE_REQUIRED',
      message:
        'This change is not limited to your units; a tenant-wide grant is required',
    });
  }
}
