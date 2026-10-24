import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AdminCard } from '../shared/admin-card';

const INFO = 'Status rules are no longer written as code or kept in the browser. Build them in Codes & rules: choose fields and conditions, try them on past events, keep every version; the server applies them.';

/** Admin panel › Status automation: where the rules are now (replaces the old browser-side editor). */
export function StatusAutomationCard() {
  return (
    <AdminCard
      title="Status automation"
      info={INFO}
      testId="status-rules-moved"
      actions={
        <Button asChild variant="outline" className="h-9">
          <Link to="/master-data/codes-rules?tab=rules">Open the rules</Link>
        </Button>
      }
    >
      <p className="text-sm">Status automation moved to rules in Codes &amp; rules.</p>
    </AdminCard>
  );
}
