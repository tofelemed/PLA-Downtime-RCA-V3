import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { brandingService, type BrandingSettings } from '@/services/BrandingService';

const BRANDING_KEY = ['app', 'branding'] as const;

/**
 * Application-wide branding (name, subtitle, logo) through TanStack Query: fetched once after sign-in,
 * refreshed when the admin panel announces a change (`brandingUpdated` window event).
 */
export function useBranding(enabled: boolean): BrandingSettings | undefined {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: BRANDING_KEY,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: () => brandingService.getBranding(),
  });
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: BRANDING_KEY });
    window.addEventListener('brandingUpdated', refresh);
    return () => window.removeEventListener('brandingUpdated', refresh);
  }, [queryClient]);
  return query.data;
}
