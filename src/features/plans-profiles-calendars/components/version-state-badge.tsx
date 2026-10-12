import { Badge } from '@/components/ui/badge';
import { labelOf, VERSION_STATE_LABELS } from '@/features/ux-kit/labels';

const VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  approved: 'default',
  published: 'default',
  draft: 'secondary',
  submitted: 'secondary',
  superseded: 'outline',
  retired: 'outline',
};

/** Plan, profile, rate and calendar version states (calendars are published, not approved). */
const STATE_LABELS: Readonly<Record<string, string>> = { ...VERSION_STATE_LABELS, published: 'Published' };

/** A version state as text (colour is never the only signal); the token stays in `data-state` for tests. */
export function VersionStateBadge({ state }: { state: string }) {
  return (
    <Badge variant={VARIANT[state] ?? 'outline'} data-testid="version-state" data-state={state}>
      {labelOf(STATE_LABELS, state)}
    </Badge>
  );
}
