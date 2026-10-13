import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import type { BrandingView } from '@/api/v2/types/administration';

const BRANDING_KEY = ['v2', 'app', 'branding'] as const;

/**
 * Application-wide branding (name, subtitle, logo) from `GET /v2/branding` (readable by every user):
 * fetched once after sign-in, refreshed when the admin panel announces a change (`brandingUpdated`).
 */
export function useBranding(enabled: boolean): BrandingView | undefined {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: BRANDING_KEY,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => (await v2Request<BrandingView>({ method: 'GET', path: '/branding', signal })).data,
  });
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: BRANDING_KEY });
    window.addEventListener('brandingUpdated', refresh);
    return () => window.removeEventListener('brandingUpdated', refresh);
  }, [queryClient]);
  return query.data;
}
