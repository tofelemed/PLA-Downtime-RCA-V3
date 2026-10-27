import type { ReactNode } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DurationText } from '@/features/ux-kit/duration-text';
import {
  labelOf,
  OEE_COMPONENT_LABELS,
  PHYSICAL_TYPE_LABELS,
  SCHEDULE_CLASS_LABELS,
  SOURCE_KIND_LABELS,
  useAssetNames,
} from '@/features/ux-kit/labels';
import { EVENT_TYPE_LABELS, FAILURE_SEVERITY_LABELS, SEVERITY_LABELS } from '@/features/ux-kit/labels/event-hub-labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { hasSplit } from '../model/reason-split';
import { eventSourceText, sourceNameOf } from '../model/source-ownership';
import { useEventHubEnv } from '../use-event-hub-env';
import { DeclaredSummary } from './declared-summary';
import { AccountingStateChip } from './accounting-state-chip';
import { ReasonWeightsText } from './reason-weights-text';
import { StateBadges } from './state-badges';
import { UnitLabel } from './unit-label';
import { VerificationChip } from './verification-chip';

function Row({ term, children, testId }: { term: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

/** E-5: "From PI" beside a value the source owns (from the server's `sourceOwnedFields`). */
function FromSource({ event, field }: { event: ProductionEventView; field: string }) {
  if (!(event.sourceOwnedFields ?? []).includes(field)) return null;
  return (
    <span className="ml-2 text-xs text-muted-foreground" data-testid={`from-source-${field}`}>
      From {sourceNameOf(event)}
    </span>
  );
}

/**
 * The event's facts as the server holds them: states and verification, interval, duration, unit, asset, codes,
 * the event severity and (stops) the failure severity, and the data source ("Origin" is the cause unit / asset).
 */
export function EventSummary({ event }: { event: ProductionEventView }) {
  const env = useEventHubEnv();
  const assets = useAssetNames();
  const { dateTime } = usePlantFormat();
  const { classification: c } = event;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <StateBadges states={event.states} className="contents" />
        <AccountingStateChip event={event} />
        <VerificationChip event={event} />
      </div>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr_9rem_1fr]">
        <Row term="Start">
          {dateTime(event.startTime)}
          <FromSource event={event} field="startTime" />
        </Row>
        <Row term="End">
          {event.endTime ? dateTime(event.endTime) : 'Ongoing'}
          <FromSource event={event} field="endTime" />
        </Row>
        <Row term={event.isOpen ? 'Elapsed' : 'Duration'} testId="detail-duration">
          <DurationText seconds={event.isOpen ? event.elapsedSeconds : event.durationSeconds} />
        </Row>
        <Row term="Unit"><UnitLabel unitId={event.unitId} /></Row>
        <Row term="Asset">
          {event.assetId ? assets.nameOf(event.assetId) : '—'}
          <FromSource event={event} field="assetId" />
        </Row>
        <Row term="Reason" testId="detail-reason">
          {hasSplit(event.reasonWeights) ? <ReasonWeightsText weights={event.reasonWeights} /> : env.reasonName(event.reasonCodeId)}
        </Row>
        <Row term="Kind">{labelOf(PHYSICAL_TYPE_LABELS, c.physicalType)}</Row>
        <Row term="Schedule class">{labelOf(SCHEDULE_CLASS_LABELS, c.scheduleClass)}</Row>
        <Row term="OEE component">{labelOf(OEE_COMPONENT_LABELS, c.oeeComponent)}</Row>
        <Row term="Event family">{labelOf(EVENT_TYPE_LABELS, event.eventType)}</Row>
        <Row term="Event severity" testId="event-severity">{labelOf(SEVERITY_LABELS, event.severity)}</Row>
        {c.physicalType === 'downtime' && (
          <Row term="Failure severity" testId="failure-severity">{labelOf(FAILURE_SEVERITY_LABELS, event.failure?.severity ?? null)}</Row>
        )}
        {event.declaredFigures && c.physicalType === 'production_loss' && <DeclaredSummary figures={event.declaredFigures} />}
        <Row term="Source" testId="event-source">{eventSourceText(event, labelOf(SOURCE_KIND_LABELS, event.sourceKind))}</Row>
      </dl>
      <div className="text-sm">
        <span className="text-muted-foreground">Description: </span>
        {event.description ?? '—'}
      </div>
    </div>
  );
}
