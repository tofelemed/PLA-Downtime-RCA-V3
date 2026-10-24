import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';

/** Right of the Plans title: "New plan" for roles that write plans, the Read-only note for viewers. */
export function PlansHeaderActions() {
  const { canWritePlans } = useCapabilities();
  return (
    <>
      <ReadOnlyHint />
      {canWritePlans && (
        <Button asChild size="sm" data-testid="plan-new">
          <Link to="/planning/plans/new">
            <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
            New plan
          </Link>
        </Button>
      )}
    </>
  );
}
