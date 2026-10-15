import { useLocation } from 'react-router-dom';

/** Only event/downtime routes written by our own list links can become a return destination. */
export function eventBackTarget(value: unknown): { to: string; label: string } {
  if (typeof value !== 'string') return { to: '/events', label: 'Event Hub' };
  const invalidCharacter = [...value].some((character) => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
  if (invalidCharacter) return { to: '/events', label: 'Event Hub' };
  const pathname = value.split(/[?#]/, 1)[0];
  if (pathname === '/downtime') return { to: value, label: 'Downtime analysis' };
  if (pathname === '/events' || pathname === '/events/') return { to: value, label: 'Event Hub' };
  if (/^\/events\/[a-zA-Z0-9_-]+$/.test(pathname)) return { to: value, label: 'Event' };
  return { to: '/events', label: 'Event Hub' };
}

/** Where "Back" goes from an event page: the list (or downtime page) the user came from, with its filters. */
export function useBackTarget(): { to: string; label: string } {
  const state = useLocation().state as { listSearch?: unknown } | null;
  return eventBackTarget(state?.listSearch);
}
