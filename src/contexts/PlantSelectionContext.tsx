import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { appSettingsApi } from '../services/api/appSettingsApi';
import { Organization, Tenant, Unit, Asset } from '../services/MasterDataService';
import { useAuth } from './AuthContext';

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
  const { session, isLoading: authLoading } = useAuth();

  // Load selection from backend API - wait for authentication
  useEffect(() => {
    if (authLoading || !session) {
      setLoading(true);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const saved = await appSettingsApi.getValue<PlantSelection>('plantSelection');
        if (mounted) {
          setSelectionState(saved || null);
        }
      } catch (error) {
        console.warn('Failed to load plant selection from backend, using default', error);
        if (mounted) {
          setSelectionState(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [session, authLoading]);

  // Persist selection to backend API on change
  const setSelection = async (sel: PlantSelection | null) => {
    setSelectionState(sel);
    try {
      await appSettingsApi.setValue('plantSelection', sel);
    } catch (error) {
      console.error('Failed to save plant selection to backend', error);
    }
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