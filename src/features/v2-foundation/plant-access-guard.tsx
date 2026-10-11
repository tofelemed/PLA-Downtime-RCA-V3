import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { V2ApiError } from '@/api/v2/errors';
import { useFeatureFlags } from '@/api/v2/queries/feature-flags';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { isTenantRefusal } from './tenant-refusal';

/**
 * Central check of the selected plant: the feature-flag bootstrap query (sent for every screen with the
 * acting `X-Tenant-Id`) answers 403 TENANT_NOT_ALLOWED when the user may not act there, e.g. a stored
 * selection the server no longer accepts. Instead of a screen that waits for flags that never come and an
 * empty menu, the user gets a clear refusal and a way back to the home plant.
 */
export function PlantAccessGuard({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { selection, setSelection } = usePlantSelection();
  const flags = useFeatureFlags();
  const refused = selection?.tenant ?? null;
  if (!refused || !isTenantRefusal(flags.error)) return <>{children}</>;

  const home = session?.tenant ?? null;
  const correlationId = flags.error instanceof V2ApiError ? flags.error.correlationId : null;
  const switchToHome = () =>
    setSelection(home ? { organization: session?.organization ?? undefined, tenant: home } : null);

  return (
    <Alert data-state="no-permission" data-testid="plant-access-refused" className="max-w-2xl">
      <Lock className="h-4 w-4" />
      <AlertTitle>You do not have access to this plant</AlertTitle>
      <AlertDescription>
        <p>
          The server refused {refused.name}: it is outside your organisation or your scope grants. Switch
          back to a plant you are a member of to continue.
        </p>
        {correlationId && <p className="mt-1 text-xs">Reference: {correlationId}</p>}
        <Button variant="outline" size="sm" className="mt-3" onClick={switchToHome}>
          Switch to my plant{home ? ` (${home.name})` : ''}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
