import { Link } from 'react-router-dom';
import { useRcaLinks, useRcaOutcome } from '@/api/v2/queries/rca-cases';
import type { ApprovedImpactView, RcaLinkView } from '@/api/v2/types/rca';
import { currencyDigits, entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { triggerLinkOf } from '../model/case-trace';
import { linkedEventKind } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { useCaseWorkspace } from './case-context';
import { plural } from '@/features/ux-kit/format/plural';

interface EventSnapshot {
  start?: unknown;
  physicalType?: unknown;
}

function TriggerText({ link, others }: { link: RcaLinkView; others: number }) {
  const { dateTime } = useRcaFormat();
  const { basePath } = useCaseWorkspace();
  const { number } = useNumberFormat();
  const event = (link.evidence?.event ?? {}) as EventSnapshot;
  const kind = linkedEventKind(event.physicalType);
  const start = typeof event.start === 'string' ? ` from ${dateTime(event.start)}` : '';
  return (
    <span data-testid="case-trigger">
      Triggered by:{' '}
      <Link className="underline" to={`/events/${encodeURIComponent(link.targetId)}`}>
        {kind}
        {start}
      </Link>
      {others > 0 && (
        <>
          {' '}
          <Link className="underline" to={`${basePath}/links`}>
            +{plural(others, 'more event', 'more events', number)}
          </Link>
        </>
      )}
    </span>
  );
}

/** The approved historical loss of the case as the server reports it: quantities, then the display currency. */
function ApprovedLossText({ impact }: { impact: ApprovedImpactView }) {
  const { currency } = useDisplayCurrency();
  if (impact.lines === 0) return <span data-testid="case-approved-loss">No approved loss yet</span>;
  const money = entriesInCurrency(impact.values, (row) => row.currency, currency);
  return (
    <span data-testid="case-approved-loss">
      Approved loss{' '}
      {impact.quantities.map((row, index) => (
        <span key={`${row.kind}:${row.uom ?? '-'}`}>
          {index > 0 ? ' · ' : ''}
          <Quantity value={row.quantity} uom={row.uom} />
        </span>
      ))}
      {money.map((row) => (
        <span key={row.currency}>
          {' / '}
          {row.amount === null ? `${row.currency} not valued` : <Quantity value={row.amount} uom={row.currency} fractionDigits={currencyDigits(row.currency)} />}
        </span>
      ))}
    </span>
  );
}

/**
 * G-3: "Triggered by: <event> · Approved loss <quantity> / <money>" in the case header, from the two queries
 * of the links page (links and outcome), so the trace is visible without opening that page.
 */
export function CaseTrace() {
  const { rca } = useCaseWorkspace();
  const links = useRcaLinks(rca.id);
  const outcome = useRcaOutcome(rca.id);
  const { trigger, others } = triggerLinkOf(links.data ?? []);
  const impact = outcome.data?.approvedHistoricalLoss;
  if (!trigger && !impact) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-sm" data-testid="case-trace">
      {trigger ? <TriggerText link={trigger} others={others} /> : <span>Not linked to an event</span>}
      {impact && (
        <>
          <span aria-hidden="true">·</span>
          <ApprovedLossText impact={impact} />
        </>
      )}
    </span>
  );
}
