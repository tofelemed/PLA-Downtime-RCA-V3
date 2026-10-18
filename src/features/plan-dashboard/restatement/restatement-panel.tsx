import { useRestatement } from '@/api/v2/queries/restatement';
import type { DeltaFigureView, RestatementView, TotalsDeltaView } from '@/api/v2/types/restatement';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { POSTING_TREATMENT_LABELS, RESTATEMENT_FIGURE_LABELS } from '../model/restatement-labels';
import { useReasonCodeName } from '../hooks/use-reason-code-name';
import { reasonChangesOf } from '../model/reason-changes';
import { PostingForm } from './posting-form';

function Cell({ value, digits }: { value: string | null; digits: ReturnType<typeof useCalendarPreference>['digits'] }) {
  return <td className="px-2 text-right tabular-nums">{value === null ? '—' : formatDecimal(value, 2, digits)}</td>;
}

function QuantityText({ value, uom }: { value: string; uom: string | null }) {
  const { digits } = useCalendarPreference();
  return <>{formatDecimal(value, 2, digits)}{uom ? ` ${uom}` : ''}</>;
}

function Row({ label, figure, uom }: { label: string; figure: DeltaFigureView; uom: string | null }) {
  const { digits } = useCalendarPreference();
  const changed = figure.delta !== null && figure.delta !== '0';
  return (
    <tr className={changed ? 'font-medium' : 'text-muted-foreground'}>
      <th className="px-2 text-left font-normal">
        {label}
        {uom ? ` (${uom})` : ''}
      </th>
      <Cell value={figure.old} digits={digits} />
      <Cell value={figure.new} digits={digits} />
      <Cell value={figure.delta} digits={digits} />
    </tr>
  );
}

function TotalsRows({ rows }: { rows: TotalsDeltaView[] }) {
  return (
    <>
      {rows.flatMap((t) =>
        Object.entries(t.figures).map(([key, figure]) => <Row key={`${t.uom}-${key}`} label={RESTATEMENT_FIGURE_LABELS[key] ?? key} figure={figure} uom={t.uom} />),
      )}
    </>
  );
}

function DeltaTable({ data }: { data: RestatementView }) {
  const reasonName = useReasonCodeName();
  const { changes, rest } = reasonChangesOf(data.lines);
  return (
    <table className="w-full text-sm" data-testid="restatement-delta">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="px-2 text-left font-normal">Figure</th>
          <th className="px-2 text-right font-normal">Approved revision {data.supersededRevision}</th>
          <th className="px-2 text-right font-normal">Revision {data.revision}</th>
          <th className="px-2 text-right font-normal">Change</th>
        </tr>
      </thead>
      <tbody>
        <TotalsRows rows={data.totals} />
        <TotalsRows rows={data.actuals} />
        {changes.map((c) => (
          <tr key={`${c.kind}-${c.from ?? ''}-${c.to ?? ''}-${c.uom ?? ''}`} className="font-medium" data-testid="restatement-reason-change">
            <th className="px-2 text-left font-normal" colSpan={4}>
              Reason changed: {reasonName(c.from)} → {reasonName(c.to)} · {c.kind} loss line, <QuantityText value={c.quantity} uom={c.uom} /> unchanged
            </th>
          </tr>
        ))}
        {rest.map((l) => (
          <Row key={`${l.kind}-${l.reasonCodeId ?? ''}-${l.uom ?? ''}`} label={`Loss line · ${l.kind} · reason ${reasonName(l.reasonCodeId)}`} figure={l} uom={l.uom} />
        ))}
      </tbody>
    </table>
  );
}

/**
 * A restatement of an approved period (SME R5): old vs new figures from the server, the operational date
 * the figures describe, and finance's posting date and treatment (finance approvers decide them).
 */
export function RestatementPanel({ view }: { view: ReconciliationView }) {
  const pref = useCalendarPreference();
  const { canDecidePosting } = useCapabilities();
  const query = useRestatement(view.revision.supersedesId ? view.periodId : null, view.revision.revision);
  const data = query.data;
  if (!data) return null;
  return (
    <section className="space-y-2 rounded-md border p-3" data-testid="restatement-panel">
      <h3 className="font-medium">
        Restatement of approved revision {data.supersededRevision}
        {data.afterClose ? ' — correction after month close' : ''}
      </h3>
      <p className="text-sm text-muted-foreground">
        Operational date {formatOperationalDate(data.operationalEffectiveDate, pref)} ·{' '}
        {data.posting
          ? `posted on ${formatOperationalDate(data.posting.postingDate, pref)} as ${POSTING_TREATMENT_LABELS[data.posting.treatment]}`
          : 'posting not decided by finance yet'}
      </p>
      <DeltaTable data={data} />
      {canDecidePosting && <PostingForm data={data} />}
    </section>
  );
}
