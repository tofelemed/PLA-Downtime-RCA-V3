import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Organization, Tenant, Unit, Asset } from '../services/MasterDataService';
import { useAuth } from './AuthContext';
import { loadPlantSelection, savePlantSelection } from './plant-selection-store';

export interface PlantSelection {
  organization?: Organization;
  tenant?: Tenant;
  unit?: Unit;
  asset?: Asset;
}

interface PlantSelectionContextType {
  selection: PlantSelection | null;
  setSelection: (selection: PlantSelection | null) => void;
  loading: boolean;
}

const PlantSelectionContext = createContext<PlantSelectionContextType | undefined>(undefined);

/** The current user's plant selection, kept per user in this browser (see plant-selection-store). */
export const PlantSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [selection, setSelectionState] = useState<PlantSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, isLoading: authLoading } = useAuth();
  const user = session?.user ?? null;

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(true);
      return;
    }
    setSelectionState(loadPlantSelection(user));
    setLoading(false);
  }, [user, authLoading]);

  const setSelection = (next: PlantSelection | null) => {
    setSelectionState(next);
    if (user) savePlantSelection(user, next);
  };

  return (
    <PlantSelectionContext.Provider value={{ selection, setSelection, loading }}>
      {children}
    </PlantSelectionContext.Provider>
  );
};

export const usePlantSelection = () => {
  const ctx = useContext(PlantSelectionContext);
  if (!ctx) throw new Error('usePlantSelection must be used within PlantSelectionProvider');
  return ctx;
};
