import { Link } from 'react-router-dom';
import type { RcaPortfolioRowView } from '@/api/v2/types/rca-portfolio';
import { currencyDigits } from '@/features/display-currency/money-format';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { statusLabel } from '../model/rca-labels';
import { caseHref } from './portfolio-model';

const LINK = 'text-primary underline-offset-2 hover:underline';

export function CauseCell({ row }: { row: RcaPortfolioRowView }) {
  if (!row.causeCode) return <span className="text-muted-foreground">Uncoded (no catalogue cause of this kind)</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{row.causeCode.code}</span>
      <span>{row.causeCode.name}</span>
      {!row.causeCode.active && (
        <StatusBadge tone="warning" data-testid="portfolio-retired">
          Retired
        </StatusBadge>
      )}
    </span>
  );
}

/** Cases by status and the newest cases, each opening the case (its actions and loss lines are one tab away). */
export function CasesCell({ row }: { row: RcaPortfolioRowView }) {
  const { number } = useNumberFormat();
  const statuses = row.cases.byStatus.map((s) => `${number(s.count)} ${statusLabel(s.status)}`).join(' · ');
  return (
    <span className="flex flex-col gap-1" data-testid="portfolio-cases">
      <span className="font-medium">{number(row.cases.total)}</span>
      <span className="text-xs text-muted-foreground">{statuses}</span>
      {row.cases.sample.map((c) => (
        <span key={c.id} className="flex flex-wrap gap-2 text-xs">
          <Link to={caseHref(c.id)} className={LINK} data-testid="portfolio-case-link">
            {c.title}
          </Link>
          <Link to={caseHref(c.id, 'actions')} className={LINK} aria-label={`Actions of ${c.title}`}>
            Actions
          </Link>
          <Link to={caseHref(c.id, 'links')} className={LINK} aria-label={`Loss lines and events of ${c.title}`}>
            Loss lines
          </Link>
        </span>
      ))}
    </span>
  );
}

/** The approved loss in the display currency as the server reported it; null amount = not valued (never 0). */
export function ApprovedLossCell({ row, currency }: { row: RcaPortfolioRowView; currency: string }) {
  const value = row.approvedLoss.values?.find((v) => v.currency === currency);
  if (row.approvedLoss.lines === 0) return <span className="text-muted-foreground">No approved loss</span>;
  if (!value) return <span className="text-muted-foreground">Not reported in {currency}</span>;
  if (value.amount === null) return <span className="text-muted-foreground">Not valued</span>;
  return (
    <span className="flex flex-col items-end" data-testid="portfolio-approved" data-status={value.status}>
      <Quantity value={value.amount} uom={value.currency} fractionDigits={currencyDigits(value.currency)} />
      {value.status === 'mixed' && <span className="text-xs text-muted-foreground">(partly valued)</span>}
      {value.fxProvisional && <span className="text-xs text-warning">(provisional exchange rate)</span>}
    </span>
  );
}

/** The owners' claims in the display currency; claims in another currency are counted, never converted. */
export function ClaimedCell({ row, currency }: { row: RcaPortfolioRowView; currency: string }) {
  const { number } = useNumberFormat();
  const claim = row.claimedAvoided?.find((c) => c.currency === currency);
  return (
    <span className="flex flex-col items-end" data-testid="portfolio-claimed">
      {claim ? <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} /> : <span className="text-muted-foreground">None</span>}
      {row.claimsInOtherCurrencies > 0 && <span className="text-xs text-muted-foreground">+{number(row.claimsInOtherCurrencies)} in another currency</span>}
    </span>
  );
}

export function ActionsCell({ row }: { row: RcaPortfolioRowView }) {
  const { number } = useNumberFormat();
  const a = row.actions;
  return (
    <span className="flex flex-col text-xs" data-testid="portfolio-actions">
      <span className="text-sm font-medium">{number(a.total)}</span>
      <span>
        {number(a.open)} open · <span className={a.overdue > 0 ? 'text-warning' : undefined}>{number(a.overdue)} overdue</span>
      </span>
      <span className="text-muted-foreground">
        {number(a.done)} done · {number(a.cancelled)} cancelled
      </span>
    </span>
  );
}

export function VerdictsCell({ row }: { row: RcaPortfolioRowView }) {
  const { number } = useNumberFormat();
  const v = row.effectiveness;
  return (
    <span className="flex flex-col text-xs" data-testid="portfolio-verdicts">
      <span>{number(v.effective)} effective</span>
      <span>{number(v.notEffective)} not effective</span>
      <span className="text-muted-foreground">
        {number(v.insufficientEvidence)} insufficient evidence · {number(v.pending)} pending
      </span>
    </span>
  );
}

const METRIC_UNITS: Readonly<Record<string, string>> = { recurrences: 'recurrences', downtime_seconds: 's downtime' };

/** Realised difference per verification metric (baseline − observed; positive = fewer than the baseline). */
export function RealizedCell({ row }: { row: RcaPortfolioRowView }) {
  const { number } = useNumberFormat();
  if (row.realized.length === 0) return <span className="text-muted-foreground">Not evaluated</span>;
  return (
    <span className="flex flex-col items-end text-xs" data-testid="portfolio-realized">
      {row.realized.map((r) => (
        <span key={r.metric}>
          <Quantity value={r.difference} uom={METRIC_UNITS[r.metric] ?? r.metric} /> ({number(r.cases)} investigations)
        </span>
      ))}
    </span>
  );
}
