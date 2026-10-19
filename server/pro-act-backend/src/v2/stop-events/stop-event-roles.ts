import { RoleName } from '../../auth/roles/role-model';
import { EVENT_WRITERS } from '../production-events/event-write-roles';

/**
 * Who decides a suggested duplicate stop (merge, keep both) and undoes a merge: the event writers
 * (`EVENT_WRITERS`, owner decision 2026-10-19: the production accountant has read-only coding). The decision
 * routes and the approval inbox's `stop-merge` kind both use this set, so who sees the item is who can
 * decide it.
 */
export const STOP_DECISION_ROLES: readonly RoleName[] = EVENT_WRITERS;
