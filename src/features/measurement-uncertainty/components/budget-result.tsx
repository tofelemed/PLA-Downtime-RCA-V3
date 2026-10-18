import type { UncertaintyContributionView } from '@/api/v2/types/uncertainty';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { COMPONENT_KIND_LABELS } from '../model/budget-form';

export interface BudgetResultProps {
  combinedStandardUncertainty: string;
  expandedUncertainty: string;
  coverageFactor: string;
  covarianceTerm: string;
  contributions: UncertaintyContributionView[];
  uom: string;
}

/**
 * The server's numbers of a budget (SME E4): combined standard uncertainty u_c (root sum of squares with
 * covariance), expanded uncertainty U = k·u_c and each component's share of the combined variance.
 */
export function BudgetResult({ combinedStandardUncertainty, expandedUncertainty, coverageFactor, covarianceTerm, contributions, uom }: BudgetResultProps) {
  const format = useNumberFormat();
  return (
    <div className="space-y-2 text-sm" data-testid="budget-result">
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">Combined standard uncertainty u_c</dt>
        <dd className="text-right tabular-nums" data-testid="budget-combined">
          <Quantity value={combinedStandardUncertainty} uom={uom} fractionDigits={3} />
        </dd>
        <dt className="text-muted-foreground">Coverage factor k</dt>
        <dd className="text-right tabular-nums">{format.decimal(coverageFactor, 2)}</dd>
        <dt className="font-medium">Expanded uncertainty U = k·u_c</dt>
        <dd className="text-right font-medium tabular-nums" data-testid="budget-expanded">
          <Quantity value={expandedUncertainty} uom={uom} fractionDigits={3} />
        </dd>
        {covarianceTerm !== '0' && (
          <>
            <dt className="text-muted-foreground">Covariance term</dt>
            <dd className="text-right tabular-nums">{format.decimal(covarianceTerm, 3)}</dd>
          </>
        )}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-normal">Component</th>
              <th className="text-right font-normal">|c·u|</th>
              <th className="text-right font-normal">Share of variance</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => (
              <tr key={c.index}>
                <td>
                  {c.label} <span className="text-muted-foreground">({COMPONENT_KIND_LABELS[c.kind] ?? c.kind})</span>
                </td>
                <td className="text-right tabular-nums">{format.decimal(c.contribution, 3)}</td>
                <td className="text-right tabular-nums">{c.shareOfVariance === null ? '—' : format.percent(Number(c.shareOfVariance) * 100, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
