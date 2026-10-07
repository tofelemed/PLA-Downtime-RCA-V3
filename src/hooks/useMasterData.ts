import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  masterDataService,
  Organization,
  Tenant,
  Unit,
  Asset,
} from '../services/MasterDataService';

interface MasterDataState {
  organizations: Organization[];
  tenants: Tenant[];
  units: Unit[];
  assets: Asset[];
  loading: boolean;
  error: unknown;
}

export const useMasterData = () => {
  const { session } = useAuth();
  const [state, setState] = useState<MasterDataState>({
    organizations: [],
    tenants: [],
    units: [],
    assets: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const fetchHierarchy = async () => {
      if (!session) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const [orgs, tnts, unts, asts] = await Promise.all([
          masterDataService.getOrganizations(),
          masterDataService.getTenants(),
          masterDataService.getUnits(),
          masterDataService.getAssets({ tenantId: session?.tenant?.id }),
        ]);

        if (isCancelled) return;

        setState({
          organizations: orgs,
          tenants: tnts,
          units: unts,
          assets: asts,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (isCancelled) return;
        console.error('Failed to fetch hierarchy:', error);
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    };

    fetchHierarchy();

    return () => {
      isCancelled = true;
    };
  }, [session]);

  return state;
};
