import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { storageService } from '../services/StorageService';
import { Organization, Tenant, Unit, Asset } from '../services/MasterDataService';

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

export const PlantSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [selection, setSelectionState] = useState<PlantSelection | null>(null);
  const [loading, setLoading] = useState(true);

  // Load selection from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      await storageService.initialize();
      const saved = await storageService.getAppSetting<PlantSelection>('plantSelection');
      if (mounted) {
        setSelectionState(saved || null);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Persist selection to IndexedDB on change
  const setSelection = (sel: PlantSelection | null) => {
    setSelectionState(sel);
    storageService.setAppSetting('plantSelection', sel);
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