import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useMasterData = () => {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        
        // Fetch real Pro-Act hierarchy data
        const orgs = await fetch('/api/organizations').then(r => r.json());
        const tnts = await fetch('/api/tenants').then(r => r.json());
        const unts = await fetch('/api/units').then(r => r.json());
        const asts = await fetch('/api/assets').then(r => r.json());
        
        setOrganizations(orgs);
        setTenants(tnts);
        setUnits(unts);
        setAssets(asts);
      } catch (error) {
        console.error('Failed to fetch hierarchy:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchHierarchy();
    }
  }, [session]);

  return { organizations, tenants, units, assets, loading };
};
