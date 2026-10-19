import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { startRcaHref, type StartRcaContext } from '../model/start-rca';

export interface StartRcaLinkProps {
  context: StartRcaContext;
  /** accessible name; the visible text stays short */
  label?: string;
}

/**
 * The "Start investigation" action (glossary: an RCA case is an investigation) next to a loss line, loss
 * event, Pareto reason or bad actor. Shown only to RCA writers; the click does not reach a surrounding
 * clickable row.
 */
export function StartRcaLink({ context, label = 'Start investigation' }: StartRcaLinkProps) {
  const { canWriteRca } = useCapabilities();
  if (!canWriteRca) return null;
  return (
    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
      <Link to={startRcaHref(context)} aria-label={label} data-testid="start-rca" onClick={(e) => e.stopPropagation()}>
        Start investigation
      </Link>
    </Button>
  );
}
