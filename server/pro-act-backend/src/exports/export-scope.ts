import { RequestContext } from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';

/**
 * Who may see an export job, its sources and its file (WF05, plan 2.9): a tenant-wide caller sees every
 * job of the tenant; a unit-limited caller only jobs whose content scope is a set of units all inside the
 * caller's grants — never a tenant-wide export, never one that also covers another unit. Checked on every
 * read and again at download time (grants may have changed since the request).
 */
export function canSeeExport(
  context: RequestContext,
  job: { tenantId: string; unitIds: string[] | null },
): boolean {
  const allowed = restrictedUnitIds(context, job.tenantId);
  if (!allowed) return true;
  if (!job.unitIds) return false;
  return job.unitIds.every((unitId) => allowed.includes(unitId));
}
