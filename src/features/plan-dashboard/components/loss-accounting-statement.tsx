import type { ReactNode } from 'react';
import type { LossStatementView } from '@/api/v2/types/loss-statement';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { cn } from '@/lib/utils';
import { identityText, statementMarker, statementRows, type StatementRow } from '../model/loss-accounting-statement';

const DIGITS = 3;

export interface LossAccountingStatementProps {
  statement: LossStatementView;
  /** heading above the table (e.g. "Day accounting"); none = no heading */
  title?: string;
  /** a link or note beside the marker (e.g. to the period) */
  actions?: ReactNode;
  testId?: string;
}

function Figure({ row, uom }: { row: StatementRow; uom: string | null }) {
  if (row.value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {row.negative && Number(row.value) !== 0 ? '−' : ''}
      <Quantity value={row.value} uom={uom} fractionDigits={DIGITS} />
    </span>
  );
}

function StatementTableRow({ row, uom }: { row: StatementRow; uom: string | null }) {
  return (
    <tr className={cn('border-b last:border-b-0', row.total && 'font-semibold')} data-testid="statement-row" data-key={row.key} data-value={row.value ?? ''}>
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        <span className={cn('inline-flex items-center gap-1', row.total && 'font-semibold')}>
          {row.label}
          <KpiInfo label={row.label} text={row.info} />
        </span>
      </th>
      <td className="py-1 text-right">
        <Figure row={row} uom={uom} />
      </td>
    </tr>
  );
}

function Marker({ statement }: { statement: LossStatementView }) {
  const marker = statementMarker(statement);
  return (
    <StatusBadge tone={marker === 'Approved' ? 'success' : 'warning'} data-testid="statement-marker">
      {marker}
    </StatusBadge>
  );
}

/**
 * The loss accounting statement (owner requirement, 27 Oct 2026): planned, actual, shortfall, the losses by
 * kind, gross attributed, verified recovery, net accounted and unaccounted loss, each with a plain-words ⓘ,
 * the Approved / Provisional marker and the identity line. Pure presentation: every figure is the server's.
 */
export function LossAccountingStatement({ statement, title, actions, testId = 'loss-statement' }: LossAccountingStatementProps) {
  const numbers = useNumberFormat();
  const rows = statementRows(statement);
  const unit = statement.uom ?? '';
  const format = (value: string | null) => (value === null ? '—' : `${numbers.decimal(value, DIGITS)} ${unit}`.trim());
  return (
    <section className="space-y-2" data-testid={testId} data-revision-state={statement.revisionState}>
      <div className="flex flex-wrap items-center gap-2">
        {title && <h3 className="text-sm font-semibold">{title}</h3>}
        <Marker statement={statement} />
        {actions}
      </div>
      <table className="w-full max-w-xl text-sm" aria-label={title ?? 'Accounting result'}>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="py-1 text-left font-medium">
              Accounting result
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {statement.uom ?? 'Quantity'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StatementTableRow key={row.key} row={row} uom={statement.uom} />
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground" data-testid="statement-identity">
        {identityText(format, statement)}
      </p>
    </section>
  );
}
