import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface EventLinkProps {
  eventId: string;
  children: ReactNode;
  className?: string;
  /** accessible name when the visible text repeats on a page ("Open event") */
  ariaLabel?: string;
}

/**
 * A real link to the event page (opens in a new tab with the browser's own gestures) that carries the
 * current page as the back target, like the loss-event list does.
 */
export function EventLink({ eventId, children, ariaLabel, className = 'text-primary underline-offset-2 hover:underline' }: EventLinkProps) {
  const location = useLocation();
  return (
    <Link to={`/events/${encodeURIComponent(eventId)}`} state={{ listSearch: `${location.pathname}${location.search}` }} aria-label={ariaLabel} className={className} data-testid="event-link" data-event-id={eventId}>
      {children}
    </Link>
  );
}
