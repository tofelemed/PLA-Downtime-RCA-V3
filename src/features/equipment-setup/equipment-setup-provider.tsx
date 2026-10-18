import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { EquipmentJourneyContext } from './journey-context';
import { emptySelection, journeyKey, readJourney, storeJourney, type SetupJourney } from './journey-storage';
import { rememberedSelection } from './journey-storage';
import { setupStep } from './setup-steps';

function ScopedJourney({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [journey, setJourney] = useState<SetupJourney | null>(() => readJourney(storageKey));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => storeJourney(storageKey, journey), [storageKey, journey]);
  useEffect(() => {
    const patch = rememberedSelection(pathname);
    setJourney((current) => current && Object.entries(patch).some(([key, value]) => current[key as keyof SetupJourney] !== value) ? { ...current, ...patch } : current);
  }, [pathname]);
  const openStep = (stepId: string) => {
    const next = { ...(journey ?? emptySelection), stepId: setupStep(stepId).id };
    storeJourney(storageKey, next);
    setJourney(next);
    navigate(setupStep(next.stepId).to(next));
  };
  const chooseUnit = (unitId: string) => {
    const next = { ...(journey ?? { ...emptySelection, stepId: 'unit' }), unitId, planId: '', periodId: '' };
    storeJourney(storageKey, next);
    setJourney(next);
  };
  const stop = () => { storeJourney(storageKey, null); setJourney(null); };
  return <EquipmentJourneyContext.Provider value={{ journey, openStep, chooseUnit, stop }}>{children}</EquipmentJourneyContext.Provider>;
}
export function EquipmentSetupProvider({ children }: { children: ReactNode }) {
  const tenantId = useV2TenantId();
  const userId = useCurrentUserId();
  if (!tenantId || !userId) return <>{children}</>;
  const key = journeyKey(tenantId, userId);
  return <ScopedJourney key={key} storageKey={key}>{children}</ScopedJourney>;
}
