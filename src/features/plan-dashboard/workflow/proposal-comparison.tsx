import type { ChangeProposalView } from '@/api/v2/types/reconciliation';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { withUnit } from '@/features/ux-kit/format/units';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { proposalComparison, type ComparisonGroup, type ComparisonRow } from '../model/snapshot-figures';

function Figure({ value, unit }: { value: string | null; unit: string | null }) {
  const { digits } = useNumberFormat();
  return <td className="px-2 text-right tabular-nums">{value === null ? '—' : unit ? withUnit(formatDecimal(value, 2, digits), unit) : formatDecimal(value, 2, digits)}</td>;
}

function Row({ row, showAfter }: { row: ComparisonRow; showAfter: boolean }) {
  const changed = showAfter && row.before !== row.after;
  return (
    <tr className={changed ? 'font-medium' : undefined} data-testid="proposal-figure">
      <th className="px-2 text-left font-normal">{row.label}</th>
      <Figure value={row.before} unit={row.unit} />
      {showAfter && <Figure value={row.after} unit={row.unit} />}
    </tr>
  );
}

function Group({ group, showAfter }: { group: ComparisonGroup; showAfter: boolean }) {
  return (
    <tbody data-testid={`proposal-group-${group.key}`}>
      <tr>
        <th colSpan={showAfter ? 3 : 2} className="px-2 pt-2 text-left">
          {group.title} <span className="font-normal text-muted-foreground">· {group.note}</span>
        </th>
      </tr>
      {group.rows.map((row) => (
        <Row key={row.key} row={row} showAfter={showAfter} />
      ))}
    </tbody>
  );
}

/**
 * QA audit P-1: the proposal's figures before (approved) and after (new inputs with the approved
 * decisions), curated and labelled with units; the reconciliation and each calculated ledger in their own
 * group. Without an "after" snapshot only the approved figures are shown.
 */
export function ProposalComparison({ p }: { p: ChangeProposalView }) {
  const groups = proposalComparison(p.before, p.after);
  if (groups.length === 0) return null;
  const showAfter = p.after !== null;
  return (
    <details className="text-xs" data-testid="proposal-comparison">
      <summary className="cursor-pointer">Figures before and after</summary>
      {!showAfter && <p className="pt-1 text-muted-foreground">The new figures are calculated when the proposal is accepted.</p>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-2 text-left font-normal">Figure</th>
              <th className="px-2 text-right font-normal">Before (approved)</th>
              {showAfter && <th className="px-2 text-right font-normal">After (with the approved decisions)</th>}
            </tr>
          </thead>
          {groups.map((group) => (
            <Group key={group.key} group={group} showAfter={showAfter} />
          ))}
        </table>
      </div>
    </details>
  );
}
