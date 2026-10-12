import { useLocation } from 'react-router-dom';

/** Where a sub-page's back link goes: the list the user came from (with its filters), else `fallback`. */
export function useBackTarget(fallback: string): string {
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/connectivity') ? from : fallback;
}
