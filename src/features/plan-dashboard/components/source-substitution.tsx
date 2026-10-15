import type { RankedSourceView, SourceSubstitutionView } from '@/api/v2/types/periods';
import { labelOf } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ACTUALS_SOURCE_LABELS, SOURCE_CLASS_LABELS, SUBSTITUTION_REASON_LABELS } from '../model/actuals-labels';

const sourceText = (ref: RankedSourceView) => {
  const what = ref.sourceClass ? labelOf(SOURCE_CLASS_LABELS, ref.sourceClass) : labelOf(ACTUALS_SOURCE_LABELS, ref.source);
  return `${what} (rank ${ref.rank}${ref.boundary ? `, ${ref.boundary}` : ''})`;
};

const lagText = (seconds: number) => (seconds % 3600 === 0 ? `${seconds / 3600} h` : seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`);

/**
 * SME E7: the substitution flag of a slice as the server decided it — which lower-ranked source (or the
 * approved estimate) gave the actuals, which source it replaced and why, and how another measurement
 * boundary was bridged (stock change accounted for, lag, evidence). Digits follow the plant setting.
 */
export function SourceSubstitution({ substitution }: { substitution: SourceSubstitutionView }) {
  const { text } = useNumberFormat();
  const bridge = substitution.crossBoundary;
  return (
    <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs" data-testid="source-substitution" data-source-class={substitution.used.sourceClass ?? ''}>
      <span className="font-medium">Substituted source: </span>
      {text(sourceText(substitution.used))} instead of {text(sourceText(substitution.replaced))} — {labelOf(SUBSTITUTION_REASON_LABELS, substitution.reason).toLowerCase()}.
      {bridge && (
        <span data-testid="cross-boundary">
          {' '}
          Measured at {bridge.fromBoundary ?? 'another boundary'}, {text(lagText(bridge.lagSeconds))} later, stock change accounted for ({bridge.evidenceRef}).
        </span>
      )}
    </p>
  );
}
