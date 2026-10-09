import { Badge } from '@/components/ui/badge';

const VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  approved: 'default',
  published: 'default',
  draft: 'secondary',
  submitted: 'secondary',
  superseded: 'outline',
  retired: 'outline',
};

/** A version state as text (colour is never the only signal). */
export function VersionStateBadge({ state }: { state: string }) {
  return (
    <Badge variant={VARIANT[state] ?? 'outline'} data-testid="version-state" data-state={state}>
      {state}
    </Badge>
  );
}
