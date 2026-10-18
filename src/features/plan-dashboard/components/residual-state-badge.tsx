import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { StatusTone } from '@/features/ux-kit/status-tone';
import { residualStateOf, type ResidualTone } from '../model/residual-state';

/** Above tolerance is an alarm (red, §5.8); within tolerance is healthy; not computable is neutral. */
const TONE: Readonly<Record<ResidualTone, StatusTone>> = { ok: 'success', warning: 'danger', unknown: 'neutral' };

/** The residual's state in words ("Within tolerance" / "Above tolerance") from the server's flags. */
export function ResidualStateBadge({ flags }: { flags: readonly string[] }) {
  const state = residualStateOf(flags);
  if (!state) return null;
  return (
    <StatusBadge tone={TONE[state.tone]} data-testid="residual-state" data-tone={state.tone}>
      {state.label}
    </StatusBadge>
  );
}
