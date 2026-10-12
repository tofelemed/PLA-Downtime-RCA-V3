import type { VersionState } from '@/api/v2/types/profiles';
import { Badge } from '@/components/ui/badge';
import { labelOf, VERSION_STATE_LABELS } from '@/features/ux-kit/labels';

const VARIANT: Readonly<Record<string, 'default' | 'secondary' | 'outline'>> = { approved: 'default', draft: 'secondary' };

/** An FX rate version state as a word (colour is never the only signal). */
export function VersionStateBadge({ state }: { state: VersionState }) {
  return (
    <Badge variant={VARIANT[state] ?? 'outline'} data-testid="version-state" data-state={state}>
      {labelOf(VERSION_STATE_LABELS, state)}
    </Badge>
  );
}
