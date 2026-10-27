import { useNavigate } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { accountingHrefOf } from '../model/accounting-link';

/** Task 13: after a reason is saved, a toast that offers "View accounting" (the event's period statement). */
export function useSavedReasonToast(event: ProductionEventView) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const href = accountingHrefOf(event);
  return () =>
    toast({
      title: 'Reason saved',
      description: href ? 'The accounting of its period is recalculated with the new reason.' : undefined,
      action: href ? (
        <ToastAction altText="View accounting" onClick={() => navigate(href)} data-testid="toast-view-accounting">
          View accounting
        </ToastAction>
      ) : undefined,
    });
}
