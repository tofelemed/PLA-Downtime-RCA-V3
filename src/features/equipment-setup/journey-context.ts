import { createContext, useContext } from 'react';
import type { SetupJourney } from './journey-storage';
export interface JourneyContext {
  journey: SetupJourney | null;
  openStep: (stepId: string) => void;
  chooseUnit: (unitId: string) => void;
  stop: () => void;
}
export const EquipmentJourneyContext = createContext<JourneyContext | null>(null);
export const useEquipmentJourney = () => useContext(EquipmentJourneyContext);
