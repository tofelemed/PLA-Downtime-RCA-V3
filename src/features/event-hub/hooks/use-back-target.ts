import { useLocation } from 'react-router-dom';

/** Where "Back" goes from an event page: the list (or downtime page) the user came from, with its filters. */
export function useBackTarget(fallback = '/events'): { to: string; label: string } {
  const state = useLocation().state as { listSearch?: unknown } | null;
  const from = typeof state?.listSearch === 'string' ? state.listSearch : fallback;
  if (from.startsWith('/downtime')) return { to: from, label: 'Downtime analysis' };
  if (from.startsWith('/events/') && from !== '/events/') return { to: from, label: 'Event' };
  return { to: from, label: 'Event Hub' };
}
