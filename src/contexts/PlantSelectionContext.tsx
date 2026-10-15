import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { DirectoryAsset, DirectoryOrganization, DirectoryPlant, DirectoryUnit } from '@/api/v2/types/plant-directory';
import { useAuth } from './AuthContext';
import { loadPlantSelection, savePlantSelection } from './plant-selection-store';
import { sessionAuthorityKey } from '@/features/auth/session-authority-key';

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
  const [storedSelection, setSelectionState] = useState<{ owner: string | null; value: PlantSelection | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, isLoading: authLoading } = useAuth();
  const user = session?.user ?? null;
  const owner = user ? sessionAuthorityKey(user) : null;
  const ownerMatches = owner !== null && storedSelection?.owner === owner;
  const selection = !authLoading && ownerMatches ? storedSelection.value : null;
  const selectionLoading = authLoading || !ownerMatches || loading;

  useEffect(() => {
    if (authLoading || !user) {
      setSelectionState(null);
      setLoading(true);
      return;
    }
    setSelectionState({ owner, value: loadPlantSelection(user) });
    setLoading(false);
  }, [user, owner, authLoading]);

  const setSelection = useCallback(
    (next: PlantSelection | null) => {
      setSelectionState({ owner, value: next });
      if (user) savePlantSelection(user, next);
    },
    [user, owner],
  );
  // stable value: the ~60 consumers re-render only when the selection or loading state changes
  const value = useMemo(() => ({ selection, setSelection, loading: selectionLoading }), [selection, setSelection, selectionLoading]);

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
