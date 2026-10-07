import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RCAService } from './rca.service';
import { RCA } from './rca.entity';
import { RCATriggerConfigService } from '../rca-trigger-config/rca-trigger-config.service';
import {
  evaluateRcaTriggerRules,
  mapEventSeverityToRcaPriority,
} from './rca-trigger-evaluator';

export interface RcaAutoCreateResult {
  created: boolean;
  rcaId?: string;
  reason: string;
}

@Injectable()
export class RcaAutoCreateService {
  private readonly logger = new Logger(RcaAutoCreateService.name);

  constructor(
    private readonly rcaService: RCAService,
    private readonly triggerConfigService: RCATriggerConfigService,
    @InjectRepository(ProductionEvent)
    private readonly productionEventRepository: Repository<ProductionEvent>,
  ) {}

  async tryCreateForEvent(event: ProductionEvent): Promise<RcaAutoCreateResult> {
    if (!event.tenantId) {
      return { created: false, reason: 'Event has no tenantId' };
    }

    if (event.rcaId) {
      return { created: false, reason: 'Event already linked to an RCA' };
    }

    const existing = await this.rcaService.findByEvent(event.id);
    if (existing.length > 0) {
      return { created: false, reason: 'RCA already exists for this event' };
    }

    const config = await this.triggerConfigService.getActiveConfig(event.tenantId);
    if (!config?.autoCreateRca) {
      return { created: false, reason: 'Auto-create RCA is disabled for tenant' };
    }

    const evaluation = evaluateRcaTriggerRules(event, config);
    if (!evaluation.matched) {
      return { created: false, reason: evaluation.reason };
    }

    const title =
      event.description?.trim() ||
      `${event.eventType || 'Event'} — ${event.severity || 'Investigation'}`;

    const rcaPayload: Partial<RCA> = {
      id: randomUUID(),
      eventId: event.id,
      title: title.length > 255 ? `${title.slice(0, 252)}...` : title,
      description: [
        `Auto-created from production event.`,
        evaluation.reason,
        event.eventId ? `Source event ID: ${event.eventId}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
      status: 'Draft',
      priority: mapEventSeverityToRcaPriority(event.severity),
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      recommendations: JSON.stringify([]),
      evidence: JSON.stringify([]),
    };

    const rca = await this.rcaService.create(rcaPayload);

    await this.productionEventRepository.update(event.id, {
      rcaId: rca.id,
      status: event.status === 'Closed' ? event.status : 'RCA Required',
    });

    this.logger.log(
      `Auto-created RCA ${rca.id} for event ${event.id} (${evaluation.ruleName ?? evaluation.reason})`,
    );

    return {
      created: true,
      rcaId: rca.id,
      reason: evaluation.reason,
    };
  }
}
