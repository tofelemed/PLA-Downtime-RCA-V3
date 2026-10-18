import { SETUP_STEPS, type SetupSelection } from './setup-steps';
export interface SetupJourney extends SetupSelection { stepId: string }
export const emptySelection: SetupSelection = { unitId: '', connectionId: '', planId: '', periodId: '' };
export const journeyKey = (tenantId: string, userId: string) => `proact:equipment-setup:v1:${encodeURIComponent(tenantId)}:${encodeURIComponent(userId)}`;
export function readJourney(key: string): SetupJourney | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (!SETUP_STEPS.some((step) => step.id === row.stepId)) return null;
    if (!['unitId', 'connectionId', 'planId', 'periodId'].every((name) => typeof row[name] === 'string' && (row[name] as string).length <= 128)) return null;
    return row as unknown as SetupJourney;
  } catch { return null; }
}
export function storeJourney(key: string, journey: SetupJourney | null) {
  try { if (journey) sessionStorage.setItem(key, JSON.stringify(journey)); else sessionStorage.removeItem(key); } catch { /* The guide still works in memory if browser storage is unavailable. */ }
}

/** Bind remembered records to the active guide only; switching unit invalidates its plan/period. */
export function rememberedSelection(pathname: string): Partial<SetupJourney> {
  const connection = pathname.match(/^\/connectivity\/connections\/([0-9a-f-]{36})(?:\/|$)/i);
  if (connection) return { connectionId: connection[1] };
  const period = pathname.match(/^\/plans\/([0-9a-f-]{36})\/periods\/([0-9a-f-]{36})$/i);
  if (period) return { planId: period[1], periodId: period[2] };
  const plan = pathname.match(/^\/planning\/plans\/([0-9a-f-]{36})$/i);
  return plan ? { planId: plan[1] } : {};
}
