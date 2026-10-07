import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { MasterDataService, DashboardConfiguration } from '../services/MasterDataService';

const masterDataService = new MasterDataService();

export function useDashboardConfig() {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [tenantId]);

  const loadConfig = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let dashboardConfig = await masterDataService.getDashboardConfiguration(tenantId);
      
      if (!dashboardConfig) {
        // Initialize with default configuration if none exists
        dashboardConfig = await masterDataService.initializeDashboardConfiguration(tenantId);
      }
      
      setConfig(dashboardConfig);
    } catch (err) {
      console.error('Failed to load dashboard configuration:', err);
      setError('Failed to load dashboard configuration');
    } finally {
      setLoading(false);
    }
  };

  const refreshConfig = () => {
    loadConfig();
  };

  return {
    config,
    loading,
    error,
    refreshConfig,
  };
} 