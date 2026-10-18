import { createContext, useContext } from 'react';
import type { EquipmentReadinessView } from '@/api/v2/types/equipment-readiness';

/** Empty on errors or scope changes: previous equipment's green checks must never carry over. */
export const ReadinessContext = createContext<EquipmentReadinessView | null>(null);
export const useReadinessChecks = () => useContext(ReadinessContext);
