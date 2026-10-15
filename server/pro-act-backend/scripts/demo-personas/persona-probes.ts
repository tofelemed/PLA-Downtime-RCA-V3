/**
 * API probes of the demo persona catalogue (demo data only): each proves one effective right of a persona
 * in the plant it acts on (`verify-personas.ts`). Split out of `persona-catalog.ts`.
 */
import type { PlantKey, Probe, ProbeExpectation } from './persona-catalog';

// --- probes -------------------------------------------------------------------------------------

/** Flag the `PUT flag` probe sets to its current value (read from the database before verifying). */
export const FLAG_PROBE_KEY = 'v2.rca';

export function listFlags(
  plant: Probe['plant'],
  expect: ProbeExpectation,
): Probe {
  return {
    label: `GET flags@${plant}`,
    method: 'GET',
    path: '/api/v2/feature-flags',
    plant,
    expect,
  };
}

/** Idempotent set of a flag to its current value: 200 for manager_approver, no data change. */
export function setFlag(plant: PlantKey, expect: ProbeExpectation): Probe {
  return {
    label: `PUT flag@${plant}`,
    method: 'PUT',
    path: `/api/v2/feature-flags/${FLAG_PROBE_KEY}`,
    plant,
    body: 'flag',
    expect,
  };
}

/** `@Roles('SuperAdmin')` route: 403 FORBIDDEN_ROLE for everyone else, before any handler runs. */
export function editAuditLog(plant: PlantKey, expect: ProbeExpectation): Probe {
  return {
    label: `PUT audit-log@${plant}`,
    method: 'PUT',
    path: '/api/audit-logs/00000000-0000-4000-8000-000000000000',
    plant,
    body: 'empty',
    expect,
  };
}

/** A role-guarded create with an empty body: guards pass → 4xx validation, never a write. */
function create(
  label: string,
  path: string,
  plant: PlantKey,
  expect: ProbeExpectation,
): Probe {
  return {
    label: `${label}@${plant}`,
    method: 'POST',
    path,
    plant,
    body: 'empty',
    expect,
  };
}

export const createPlan = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST plan', '/api/v2/production-plans', plant, expect);
export const createEvent = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST event', '/api/v2/production-events', plant, expect);
export const createRca = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST rca', '/api/v2/rcas', plant, expect);
export const createConnection = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST connection', '/api/v2/connections', plant, expect);
export const createRule = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST rule', '/api/v2/rules', plant, expect);
export const createPolicy = (plant: PlantKey, expect: ProbeExpectation) =>
  create('POST valuation policy', '/api/v2/valuation-policies', plant, expect);
/** Quality / Lab decision on a disposition no plant has: guards pass → 4xx, never a write. */
export const approveDisposition = (plant: PlantKey, expect: ProbeExpectation) =>
  create(
    'POST approve lot disposition',
    '/api/v2/lot-dispositions/00000000-0000-4000-8000-000000000000/approve',
    plant,
    expect,
  );
/** Metrology decision on an uncertainty budget no plant has: guards pass → 4xx, never a write. */
export const approveBudget = (plant: PlantKey, expect: ProbeExpectation) =>
  create(
    'POST approve uncertainty budget',
    '/api/v2/uncertainty-budgets/00000000-0000-4000-8000-000000000000/approve',
    plant,
    expect,
  );
export const approvePolicy = (plant: PlantKey, expect: ProbeExpectation) =>
  create(
    'POST approve valuation policy',
    '/api/v2/valuation-policies/00000000-0000-4000-8000-000000000000/approve',
    plant,
    expect,
  );
