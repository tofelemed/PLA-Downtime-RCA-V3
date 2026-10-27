import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { LossStatementRowView } from '@/api/v2/types/loss-statement';
import { Button } from '@/components/ui/button';
import { LossAccountingStatement } from '@/features/plan-dashboard/components/loss-accounting-statement';
import { periodPath } from '@/features/plan-dashboard/model/period-navigation';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { STATEMENT_COLUMNS } from '../model/statement-page';

const DIGITS = 3;
const REVISION_TEXT = { approved: 'Approved', provisional: 'Provisional' } as const;

export interface StatementRowProps {
  row: LossStatementRowView;
  /** the row label: the unit and the shift (or "Day") */
  label: string;
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
}

function FigureCells({ row }: { row: LossStatementRowView }) {
  const numbers = useNumberFormat();
  const statement = row.statement;
  return (
    <>
      {STATEMENT_COLUMNS.map(({ key }) => {
        const value = statement ? (statement[key] as string | null) : null;
        const sign = key === 'recovery' && value !== null && Number(value) !== 0 ? '−' : '';
        return (
          <td key={key} className="whitespace-nowrap px-2 py-1 text-right tabular-nums" data-testid={`statement-cell-${key}`} data-value={value ?? ''}>
            {value === null ? '—' : `${sign}${numbers.decimal(value, DIGITS)}`}
          </td>
        );
      })}
    </>
  );
}

function Expansion({ row }: { row: LossStatementRowView }) {
  const link = row.planId ? (
    <Link className="text-sm font-medium text-primary hover:underline" to={periodPath(row.planId, row.periodId)} data-testid="statement-period-link">
      Open the period
    </Link>
  ) : null;
  return (
    <tr data-testid="statement-expansion" data-period-id={row.periodId}>
      <td colSpan={STATEMENT_COLUMNS.length + 2} className="bg-muted/30 px-3 py-2">
        {row.statement ? (
          <LossAccountingStatement statement={row.statement} actions={link} testId="statement-row-statement" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing to state yet for this period (no {row.revisionState === null ? 'revision in this selection' : 'calculation'}). {link}
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * One period of the statement table: its ten figures, a toggle that expands it to the full statement with a
 * link to the period page; the focused row (opened from an event) is scrolled into view.
 */
export function StatementRow({ row, label, expanded, focused, onToggle }: StatementRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center' });
  }, [focused]);
  return (
    <>
      <tr ref={ref} className={focused ? 'border-b bg-primary/5' : 'border-b'} data-testid="statement-table-row" data-period-id={row.periodId} data-focused={focused ? 'true' : undefined}>
        <th scope="row" className="px-2 py-1 text-left font-normal">
          <Button type="button" variant="ghost" size="sm" className="h-auto px-1 py-0 font-normal" aria-expanded={expanded} onClick={onToggle} data-testid="statement-row-toggle">
            {expanded ? '▾' : '▸'} {label}
          </Button>
        </th>
        <td className="px-2 py-1 text-xs text-muted-foreground">{row.revisionState ? REVISION_TEXT[row.revisionState] : 'Not in selection'}</td>
        <FigureCells row={row} />
      </tr>
      {expanded && <Expansion row={row} />}
    </>
  );
}
