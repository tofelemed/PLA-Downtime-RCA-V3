import { Badge } from '@/components/ui/badge';
import type { CandidateDerivationView, DerivationEvidenceView } from '@/api/v2/types/reconciliation';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, LEDGER_LABELS, lossBasisLabel, RATE_KIND_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { declaredShortfallOf, derivationFlagLabel, isDataFlag, rateDisplayOf, shareAsPercent, stopsCrossCheckOf } from '../model/candidate-derivation';
import { EventLink } from './event-link';

export interface CandidateDerivationProps {
  derivation: CandidateDerivationView;
  uom: string | null;
  timezone: string;
}

function RateText({ derivation, uom }: { derivation: CandidateDerivationView; uom: string | null }) {
  const { decimal } = useNumberFormat();
  const display = rateDisplayOf(derivation);
  const per = (timebase: string | null) => `${uom ?? ''}/${timebase ?? '?'}`;
  if (display.mode === 'scaled-unstored') return <span data-testid="derivation-rate-scaled">rate scaled to target — the applied rate is not stored</span>;
  if (display.mode === 'none') return <span>no rate (not a time-based loss)</span>;
  if (display.mode === 'scaled') {
    const { applied, planning } = display;
    const planningText = planning?.value ? `planning rate ${decimal(planning.value)} ${per(planning.timebase)}, ` : '';
    return (
      <span data-testid="derivation-rate-applied">
        Applied rate {decimal(applied.value)} {per(applied.timebase)} ({planningText}scaled to target)
      </span>
    );
  }
  const { rate } = display;
  const kind = rate.kind ? `${labelOf(RATE_KIND_LABELS, rate.kind)} rate ` : '';
  return (
    <span data-testid="derivation-rate">
      {kind}
      {decimal(rate.value)} {per(rate.timebase)}
    </span>
  );
}

function EvidenceItem({ item, timezone }: { item: DerivationEvidenceView; timezone: string }) {
  const { decimal } = useNumberFormat();
  const percent = shareAsPercent(item.share);
  const label = item.eventId ? <EventLink eventId={item.eventId}>Event</EventLink> : <span>Unlinked occurrence</span>;
  return (
    <li data-testid="derivation-evidence" data-event-id={item.eventId ?? ''}>
      {label} · {percent === null ? item.share : `${decimal(percent, 1)} %`} share · <PlantTime iso={item.clippedStart} tz={timezone} /> – <PlantTime iso={item.clippedEnd} tz={timezone} />
    </li>
  );
}

function CrossCheckLine({ flags }: { flags: readonly string[] }) {
  const { decimal } = useNumberFormat();
  const check = stopsCrossCheckOf(flags);
  if (!check) return null;
  return (
    <>
      <dt className="text-muted-foreground">Stops cross-check</dt>
      <dd data-testid="derivation-stops-cross-check">{decimal(check.quantity)}{check.uom ? ` ${check.uom}` : ''} recorded in stops</dd>
    </>
  );
}

/** Declared line: the OT shortfall, this event's share of it and the booked quantity; there is no rate. */
function DeclaredRows({ derivation, uom }: { derivation: CandidateDerivationView; uom: string | null }) {
  const { decimal } = useNumberFormat();
  const shortfall = declaredShortfallOf(derivation.flags);
  const share = derivation.evidence[0] ? shareAsPercent(derivation.evidence[0].share) : null;
  return (
    <dl className="mt-1 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]" data-testid="derivation-declared">
      <dt className="text-muted-foreground">Basis</dt>
      <dd data-testid="derivation-basis">{lossBasisLabel(derivation.basis)} · {labelOf(LEDGER_LABELS, derivation.ledger)}</dd>
      <dt className="text-muted-foreground">Shortfall</dt>
      <dd data-testid="derivation-shortfall">{shortfall === null ? '—' : `${decimal(shortfall)}${uom ? ` ${uom}` : ''}`} declared by OT</dd>
      <dt className="text-muted-foreground">Share</dt>
      <dd data-testid="derivation-share">{share === null ? '—' : `${decimal(share, 1)} % of the shortfall`}</dd>
      <dt className="text-muted-foreground">Quantity</dt>
      <dd>shortfall × share</dd>
      <CrossCheckLine flags={derivation.flags} />
      <dt className="text-muted-foreground">Source event</dt>
      <dd>{derivation.sourceEventId ? <EventLink eventId={derivation.sourceEventId}>Open the production loss event</EventLink> : 'none'}</dd>
    </dl>
  );
}

function ComputedRows({ derivation, uom, timezone }: CandidateDerivationProps) {
  return (
    <dl className="mt-1 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
      <dt className="text-muted-foreground">Basis</dt>
      <dd data-testid="derivation-basis">{lossBasisLabel(derivation.basis)} · {labelOf(LEDGER_LABELS, derivation.ledger)}</dd>
      <dt className="text-muted-foreground">Window</dt>
      <dd>
        <PlantTime iso={derivation.segmentStart} tz={timezone} withDate /> – <PlantTime iso={derivation.segmentEnd} tz={timezone} /> (<DurationText seconds={derivation.durationSeconds} />)
      </dd>
      <dt className="text-muted-foreground">Rate</dt>
      <dd><RateText derivation={derivation} uom={uom} /></dd>
      <dt className="text-muted-foreground">Source event</dt>
      <dd>{derivation.sourceEventId ? <EventLink eventId={derivation.sourceEventId}>Open the event</EventLink> : 'none'}</dd>
    </dl>
  );
}

/**
 * "How was this calculated?" (UX D-2): the stored inputs of one candidate as the server returns them —
 * basis and ledger, the segment and its duration, the rate version, the source event, each cause's share of
 * the segment and the engine flags. Nothing is recomputed here: a rate scaled to the target shows the applied
 * rate the engine stored (runs before it was stored say so), and no rate × duration is shown.
 */
export function CandidateDerivation({ derivation, uom, timezone }: CandidateDerivationProps) {
  const labelled = derivation.flags.filter((flag) => !isDataFlag(flag));
  return (
    <details className="mt-1 text-xs" data-testid="candidate-derivation">
      <summary className="cursor-pointer text-muted-foreground">How was this calculated?</summary>
      {derivation.basis === 'declared' ? <DeclaredRows derivation={derivation} uom={uom} /> : <ComputedRows derivation={derivation} uom={uom} timezone={timezone} />}
      {derivation.evidence.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {derivation.evidence.map((item, index) => (
            <EvidenceItem key={`${item.eventId ?? item.occurrenceId ?? 'none'}-${index}`} item={item} timezone={timezone} />
          ))}
        </ul>
      )}
      {labelled.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {labelled.map((flag) => (
            <Badge key={flag} variant="outline" data-testid="derivation-flag">
              {derivationFlagLabel(flag)}
            </Badge>
          ))}
        </div>
      )}
    </details>
  );
}
