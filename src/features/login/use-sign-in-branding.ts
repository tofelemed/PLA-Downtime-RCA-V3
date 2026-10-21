import { useQuery } from '@tanstack/react-query';
import { v2BaseUrl } from '@/api/v2/config';

/** `GET /v2/branding/public`: what the sign-in page may show before anyone signs in. */
export interface SignInBranding {
  appName: string;
  appSubtitle?: string;
  logoUrl?: string;
  logoInitials?: string;
  primaryColor?: string;
  faviconUrl?: string;
}

async function fetchSignInBranding(signal: AbortSignal): Promise<SignInBranding> {
  const response = await fetch(`${v2BaseUrl()}/branding/public`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`branding ${response.status}`);
  return (await response.json()) as SignInBranding;
}

/**
 * The configured name, subtitle and logo for the sign-in page (settings audit, 21 Oct 2026: the page showed a
 * fixed name). Undefined while loading or when the server cannot be reached: the page then shows its built-in
 * text, never an error.
 */
export function useSignInBranding(): SignInBranding | undefined {
  return useQuery({
    queryKey: ['v2', 'public', 'branding'],
    queryFn: ({ signal }) => fetchSignInBranding(signal),
    staleTime: 5 * 60_000,
    retry: false,
  }).data;
}
