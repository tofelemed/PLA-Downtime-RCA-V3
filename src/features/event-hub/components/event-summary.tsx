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
import { EVENT_TYPE_LABELS, SEVERITY_LABELS } from '@/features/ux-kit/labels/event-hub-labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';
import { StateBadges } from './state-badges';

function Row({ term, children, testId }: { term: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

/** The event's facts as the server holds them: states, interval, duration, unit, asset, codes, origin. */
export function EventSummary({ event }: { event: ProductionEventView }) {
  const env = useEventHubEnv();
  const assets = useAssetNames();
  const { dateTime } = usePlantFormat();
  const { classification: c } = event;
  return (
    <div className="space-y-3">
      <StateBadges states={event.states} />
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr_9rem_1fr]">
        <Row term="Start">{dateTime(event.startTime)}</Row>
        <Row term="End">{event.endTime ? dateTime(event.endTime) : 'Running'}</Row>
        <Row term={event.isOpen ? 'Elapsed' : 'Duration'} testId="detail-duration">
          <DurationText seconds={event.isOpen ? event.elapsedSeconds : event.durationSeconds} />
        </Row>
        <Row term="Unit">{env.unitName(event.unitId)}</Row>
        <Row term="Asset">{event.assetId ? assets.nameOf(event.assetId) : '—'}</Row>
        <Row term="Reason">{env.reasonName(event.reasonCodeId)}</Row>
        <Row term="Kind">{labelOf(PHYSICAL_TYPE_LABELS, c.physicalType)}</Row>
        <Row term="Schedule class">{labelOf(SCHEDULE_CLASS_LABELS, c.scheduleClass)}</Row>
        <Row term="OEE component">{labelOf(OEE_COMPONENT_LABELS, c.oeeComponent)}</Row>
        <Row term="Event family">{labelOf(EVENT_TYPE_LABELS, event.eventType)}</Row>
        <Row term="Severity">{labelOf(SEVERITY_LABELS, event.severity)}</Row>
        <Row term="Origin">{labelOf(SOURCE_KIND_LABELS, event.sourceKind)}</Row>
      </dl>
      <div className="text-sm">
        <span className="text-muted-foreground">Description: </span>
        {event.description ?? '—'}
      </div>
    </div>
  );
}
