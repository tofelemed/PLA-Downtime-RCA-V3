import { Badge } from '@/components/ui/badge';
import { useReportLook } from './use-report-look';

/**
 * The small "Provisional" marker of a row or figure the server marks provisional. Shown only on the Reports
 * page with Revision = Provisional; with "Approved only" and on other pages it renders nothing.
 */
export function ProvisionalMark({ when }: { when: boolean | undefined }) {
  const look = useReportLook();
  if (!look?.provisional || !when) return null;
  return (
    <Badge variant="outline" className="ml-1.5 whitespace-nowrap px-1.5 py-0 align-middle text-xs font-medium text-muted-foreground" data-testid="provisional-mark">
      Provisional
    </Badge>
  );
}
