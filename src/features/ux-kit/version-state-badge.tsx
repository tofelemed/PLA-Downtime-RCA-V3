import { labelOf, VERSION_STATE_LABELS, VERSION_STATE_TONES } from './labels';
import { StatusBadge } from './status-badge';
import { toneOf } from './status-tone';

/** Plan, profile, rate, FX and calendar version states (calendars are published, not approved). */
const STATE_LABELS: Readonly<Record<string, string>> = { ...VERSION_STATE_LABELS, published: 'Published' };

/** A version state as words with its tone; the token stays in `data-state` for tests. */
export function VersionStateBadge({ state }: { state: string }) {
  return (
    <StatusBadge tone={toneOf(VERSION_STATE_TONES, state)} data-testid="version-state" data-state={state}>
      {labelOf(STATE_LABELS, state)}
    </StatusBadge>
  );
}
