import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';

/** Secondary header link to the RCA trigger policy, only for roles that may edit it (E-L2). */
export function RcaTriggerSettingsLink() {
  const { canManageRcaPolicies } = useCapabilities();
  if (!canManageRcaPolicies) return null;
  return (
    <Button variant="ghost" asChild data-testid="rca-trigger-settings">
      <Link to="/events/rca-triggers">
        <ActionIcon.settings aria-hidden className="mr-1 h-4 w-4" />
        RCA trigger settings
      </Link>
    </Button>
  );
}
