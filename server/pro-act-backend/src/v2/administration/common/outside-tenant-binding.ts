import {
  anonymousContext,
  RequestContext,
  runWithRequestContext,
} from '../../../common/context/request-context';

/**
 * Runs `work` on connections without the caller's row-level-security tenant binding. Only after the
 * organization check: an organization administrator administers every plant of its organization but need
 * not hold a scope in it (a plant it is editing, or one it has just created), so under the binding its
 * reads of that plant's rows would see nothing and its writes there would fail the policy.
 */
export function outsideTenantBinding<T>(
  context: RequestContext,
  work: () => Promise<T>,
): Promise<T> {
  return runWithRequestContext(anonymousContext(context.correlationId), work);
}
