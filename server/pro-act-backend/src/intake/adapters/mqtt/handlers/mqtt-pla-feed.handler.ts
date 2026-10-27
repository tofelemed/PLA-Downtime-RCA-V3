import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ExternalReportSourceFigures } from '../../../../domain/actuals/period/external-report';
import { ExternalReportsService } from '../../../../periods/external-reports.service';
import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../../../normalization/normalization-handler';
import { MQTT_SOURCE_SYSTEM } from './mqtt-interval-event.handler';

/** True for a plant production day decoded by a PLA feed (plans/MQTT_FEEDS.md). */
export function isPlaFeed(envelope: CanonicalEnvelope): boolean {
  return envelope.sourceControls?.mqtt?.feed === 'pla';
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/**
 * Normaliser of PLA-feed days (owner 26 Oct 2026): the plant-day message becomes an external daily
 * production report — OT's actual booked to the feed's unit and product (basis good), source system
 * MQTT (release by the MQTT source status rules), and OT's own planned / shortfall kept as source figures
 * for comparison, never used in accounting. Revisions supersede; a repeated revision is a duplicate and
 * the same revision with other content is quarantined `order_conflict`.
 */
@Injectable()
export class MqttPlaFeedHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'mqtt-pla-feed';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly reports: ExternalReportsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return (
      envelope.sourceType === 'mqtt' &&
      envelope.kind === 'output_event' &&
      isPlaFeed(envelope)
    );
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const { envelope } = input;
    const output = envelope.values?.output;
    const unitId = envelope.location.unitId;
    if (
      !output ||
      !unitId ||
      !output.productRef ||
      !envelope.startTime ||
      !envelope.endTime
    ) {
      return {
        status: 'quarantined',
        outcome: 'unmapped',
        errorCode: 'mapping_invalid_target',
        detail: {
          reason:
            'The PLA feed names no unit or product to book the day to; set them on the feed',
        },
      };
    }
    const report = (envelope.sourceControls?.mqtt?.report ?? {}) as Record<
      string,
      unknown
    >;
    try {
      const stored = await this.reports.importOne(
        { tenantId: envelope.tenantId, userId: null },
        {
          externalReportId:
            textOrNull(envelope.sourceControls?.mqtt?.eventId) ??
            envelope.sourceObjectId,
          externalRevision: envelope.sourceRevision ?? '1',
          siteId: null,
          localProductionDate: String(report.productionDate),
          timezone: null,
          utcStart: new Date(envelope.startTime),
          utcEnd: new Date(envelope.endTime),
          basis: 'good',
          sourceStatus: textOrNull(report.status) ?? 'REPORTED',
          sourceSystem: MQTT_SOURCE_SYSTEM,
          approvedAtSource: null,
          evidenceRef: `mqtt:${textOrNull(envelope.sourceControls?.mqtt?.topic) ?? ''}`,
          connectionId: envelope.connectionId,
          sourceFigures: figuresOf(report, envelope),
          lines: [
            {
              unitId,
              productId: output.productRef,
              gross: null,
              good: String(output.quantity),
              reject: null,
              uom: output.unit ?? 't',
            },
          ],
        },
      );
      return {
        status: 'applied',
        outcome: stored.outcome === 'imported' ? 'created' : 'unchanged',
        canonicalEventId: null,
        detail: { reportId: stored.report.id, outcome: stored.outcome },
      };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        return {
          status: 'quarantined',
          outcome: 'unmapped',
          errorCode: 'order_conflict',
          detail: { reason: error.message },
        };
      }
      // the feed's unit / product is not of this plant, or the day is malformed: fix the feed, then replay
      if (error instanceof UnprocessableEntityException) {
        return {
          status: 'quarantined',
          outcome: 'unmapped',
          errorCode: 'mapping_invalid_target',
          detail: { reason: error.message },
        };
      }
      throw error;
    }
  }
}

function figuresOf(
  report: Record<string, unknown>,
  envelope: CanonicalEnvelope,
): ExternalReportSourceFigures {
  return {
    planned: numberOrNull(report.planned),
    actual: numberOrNull(report.actual),
    shortfall: numberOrNull(report.shortfall),
    uom: textOrNull(report.uom),
    status: textOrNull(report.status),
    quality: textOrNull(report.quality),
    plant: textOrNull(report.plant),
    eventType: textOrNull(report.eventType),
    topic: textOrNull(envelope.sourceControls?.mqtt?.topic),
  };
}
