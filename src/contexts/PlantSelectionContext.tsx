import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { DirectoryAsset, DirectoryOrganization, DirectoryPlant, DirectoryUnit } from '@/api/v2/types/plant-directory';
import { useAuth } from './AuthContext';
import { loadPlantSelection, savePlantSelection } from './plant-selection-store';

export interface PlantSelection {
  organization?: DirectoryOrganization;
  tenant?: DirectoryPlant;
  unit?: DirectoryUnit;
  asset?: DirectoryAsset;
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

  const setSelection = useCallback(
    (next: PlantSelection | null) => {
      setSelectionState(next);
      if (user) savePlantSelection(user, next);
    },
    [user],
  );
  // stable value: the ~60 consumers re-render only when the selection or loading state changes
  const value = useMemo(() => ({ selection, setSelection, loading }), [selection, setSelection, loading]);

  return (
    <PlantSelectionContext.Provider value={value}>
      {children}
    </PlantSelectionContext.Provider>
  );
};

export const usePlantSelection = () => {
  const ctx = useContext(PlantSelectionContext);
  if (!ctx) throw new Error('usePlantSelection must be used within PlantSelectionProvider');
  return ctx;
};
