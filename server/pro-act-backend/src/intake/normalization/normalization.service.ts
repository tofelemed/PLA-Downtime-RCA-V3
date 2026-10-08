import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InProcessEventBus } from '../../common/outbox/in-process-event-bus';
import { InboxOutcome, InboxService } from '../../common/outbox/inbox.service';
import { PublishedMessage } from '../../common/outbox/outbox-transport';
import { CanonicalEnvelope } from '../envelope/canonical-envelope';
import { SourceObject } from '../entities/source-object.entity';
import {
  ObjectKey,
  recordException,
  resolveOpenExceptions,
} from '../exceptions/exception-store';
import { normalizationKey } from '../intake.service';
import { NormalizationTicket, RawAcceptedPayload } from '../intake.types';
import { findRaw } from '../raw-store';
import { markNormalized } from '../source-object-store';
import {
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from './normalization-handler';

const CONSUMER = 'normalization';

/**
 * Consumer of `RawAccepted` (plan 1.5 step 6): loads the retained raw row, routes it by kind/source to
 * a registered handler, then records the result on the source object — applied (canonical event linked,
 * open exceptions resolved) or quarantined (`ingestion_exceptions` with the handler's error code). The
 * inbox key makes each request take effect once, whether it arrives inline (PI pull, replay) or through
 * the outbox relay. A quarantined record still counts as accepted for cursor purposes.
 */
@Injectable()
export class NormalizationService implements OnModuleInit {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly registry: NormalizationHandlerRegistry,
    private readonly inbox: InboxService,
    private readonly bus: InProcessEventBus,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe('RawAccepted', (message) => this.consume(message));
  }

  /** Runs the request under its inbox key; `duplicate` when it already took effect. */
  normalize(
    ticket: NormalizationTicket,
    hints?: unknown,
  ): Promise<InboxOutcome<NormalizationResult>> {
    return this.inbox.runOnce(
      {
        key: ticket.key,
        tenantId: ticket.tenantId,
        consumer: CONSUMER,
        type: 'RawAccepted',
      },
      () => this.process(ticket, hints),
    );
  }

  private async consume(message: PublishedMessage): Promise<void> {
    const payload = message.payload as unknown as RawAcceptedPayload;
    await this.normalize({ ...payload, key: normalizationKey(message.id) });
  }

  private async process(
    ticket: NormalizationTicket,
    hints?: unknown,
  ): Promise<NormalizationResult> {
    const input = await this.loadInput(ticket, hints);
    if (input.latestRawId !== (input.raw.originalRawId ?? input.raw.id)) {
      // a newer version was accepted meanwhile; its own request carries the current state
      return {
        status: 'applied',
        outcome: 'superseded',
        canonicalEventId: null,
      };
    }
    const result = await this.run(input);
    await this.record(ticket, input, result);
    return result;
  }

  private async loadInput(
    ticket: NormalizationTicket,
    hints?: unknown,
  ): Promise<NormalizationInput & { latestRawId: string | null }> {
    const manager = this.dataSource.manager;
    const raw = await findRaw(manager, {
      rawId: ticket.rawId,
      receivedAt: new Date(ticket.receivedAt),
    });
    if (!raw?.payload) {
      throw new Error(`raw observation ${ticket.rawId} not found`);
    }
    const object = await manager.findOne(SourceObject, {
      where: keyOf(ticket),
      select: { id: true, canonicalEventId: true, latestRawId: true },
    });
    return {
      raw,
      latestRawId: object?.latestRawId ?? null,
      envelope: raw.payload as unknown as CanonicalEnvelope,
      canonicalEventId: object?.canonicalEventId ?? null,
      hints,
    };
  }

  /** Handler failures are quarantined (`processing_failed`), never lost; replay retries them. */
  private async run(input: NormalizationInput): Promise<NormalizationResult> {
    const handler = this.registry.find(input.envelope);
    if (!handler) {
      return {
        status: 'quarantined',
        outcome: 'no_handler',
        errorCode: 'no_handler',
        detail: {
          reason: `No normaliser for ${input.envelope.sourceType} ${input.envelope.kind} yet`,
        },
      };
    }
    try {
      return await handler.handle(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `${handler.name} failed on raw ${input.raw.id}: ${message}`,
      );
      return {
        status: 'quarantined',
        outcome: 'failed',
        errorCode: 'processing_failed',
        detail: { reason: message.slice(0, 2000), handler: handler.name },
      };
    }
  }

  private async record(
    ticket: NormalizationTicket,
    input: NormalizationInput,
    result: NormalizationResult,
  ): Promise<void> {
    const key = keyOf(ticket);
    const rawId = input.raw.originalRawId ?? input.raw.id;
    await this.dataSource.transaction(async (manager) => {
      if (result.status === 'applied') {
        await markNormalized(manager, key, {
          rawId,
          canonicalEventId: result.canonicalEventId,
        });
        await resolveOpenExceptions(manager, key, {
          rawId: input.raw.id,
          replayRunId: ticket.replayRunId,
          outcome: result.outcome,
        });
        return;
      }
      await recordException(manager, {
        ...key,
        rawId: input.raw.id,
        rawReceivedAt: input.raw.receivedAt,
        errorCode: result.errorCode,
        detail: { ...result.detail, replayRunId: ticket.replayRunId },
      });
    });
  }
}

function keyOf(ticket: NormalizationTicket): ObjectKey {
  return {
    tenantId: ticket.tenantId,
    connectionId: ticket.connectionId,
    sourceObjectId: ticket.sourceObjectId,
  };
}
