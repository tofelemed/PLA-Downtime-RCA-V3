import { Link } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { accountingHrefOf, NO_ACCOUNTING_PERIOD } from '../model/accounting-link';

/**
 * Task 13 "View accounting" (every event kind, every role that reads the event): opens the Accounting
 * statement on the event's period; disabled with the reason while no period covers the event.
 */
export function ViewAccountingButton({ event }: { event: ProductionEventView }) {
  const href = accountingHrefOf(event);
  if (!href) {
    return (
      <span title={NO_ACCOUNTING_PERIOD} data-testid="view-accounting-unavailable">
        <Button size="sm" variant="outline" disabled aria-describedby="view-accounting-reason">
          View accounting
        </Button>
        <span id="view-accounting-reason" className="sr-only">
          {NO_ACCOUNTING_PERIOD}
        </span>
      </span>
    );
  }
  return (
    <Button size="sm" variant="outline" asChild>
      <Link to={href} data-testid="view-accounting">
        View accounting
      </Link>
    </Button>
  );
}

/** The same link as a small text entry of an event list row. */
export function ViewAccountingLink({ event }: { event: ProductionEventView }) {
  const href = accountingHrefOf(event);
  if (!href) return null;
  return (
    <Link to={href} className="whitespace-nowrap text-xs font-medium text-primary hover:underline" data-testid="row-view-accounting">
      View accounting
    </Link>
  );
}
