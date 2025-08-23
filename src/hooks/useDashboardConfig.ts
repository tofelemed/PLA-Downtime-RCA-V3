import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MasterDataService, DashboardConfiguration } from '../services/MasterDataService';

const masterDataService = new MasterDataService();

export function useDashboardConfig() {
  const { session } = useAuth();
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [session?.tenant?.id]);

  const loadConfig = async () => {
    if (!session?.tenant?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let dashboardConfig = await masterDataService.getDashboardConfiguration(session.tenant.id);
      
      if (!dashboardConfig) {
        // Initialize with default configuration if none exists
        dashboardConfig = await masterDataService.initializeDashboardConfiguration(session.tenant.id);
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