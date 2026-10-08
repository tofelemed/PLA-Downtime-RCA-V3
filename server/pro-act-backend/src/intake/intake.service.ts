import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { CanonicalEnvelope } from './envelope/canonical-envelope';
import {
  EnvelopeViolation,
  validateEnvelope,
} from './envelope/envelope-validator';
import { RawObservation, RawOutcome } from './entities/raw-observation.entity';
import { ObjectKey, recordException } from './exceptions/exception-store';
import {
  AcceptResult,
  AcceptStatus,
  IntakeBinding,
  NormalizationTicket,
} from './intake.types';
import { RawPartitionsService } from './partitions/raw-partitions.service';
import { invalidRawRow, rawRowOf } from './raw-row';
import {
  countDuplicateDelivery,
  DeliveryIdentity,
  insertRaw,
  registerIdentity,
} from './raw-store';
import {
  contentHashOf,
  decideOrdering,
  OrderingDecision,
} from './source-object-ordering';
import {
  advanceVersion,
  findLockedObject,
  insertIfNew,
  lockObject,
  touchObject,
  VersionRow,
} from './source-object-store';

/** Outcomes that need canonical processing. */
const NORMALIZED: ReadonlySet<RawOutcome> = new Set([
  'accepted',
  'revision',
  'replayed',
]);

/**
 * The one entry point of every adapter (plan 1.5 step 3, FND01/FND02, ING01). In one transaction:
 * validate the envelope (ajv) → register the delivery identity (repeat → `duplicate`, no raw row) →
 * append the immutable raw row → decide against the source object (new / duplicate content / newer
 * revision / stale / conflict, or a replay of the original identity) → write `RawAccepted` to the outbox
 * when canonical processing is needed. The adapter acknowledges or checkpoints only after this resolves.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);
  private readonly counters = new Map<AcceptStatus, number>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly partitions: RawPartitionsService,
  ) {}

  async accept(
    binding: IntakeBinding,
    candidate: unknown,
  ): Promise<AcceptResult> {
    const receivedAt = new Date();
    await this.partitions.ensureFor(receivedAt);
    const validation = validateEnvelope(candidate);
    const result = await this.dataSource.transaction((manager) =>
      validation.valid
        ? this.acceptValid(manager, binding, validation.envelope, receivedAt)
        : this.acceptInvalid(manager, binding, {
            candidate,
            violations: validation.violations,
            receivedAt,
          }),
    );
    this.counters.set(
      result.status,
      (this.counters.get(result.status) ?? 0) + 1,
    );
    return result;
  }

  /** Accept outcomes since process start (metrics; exported by plan 3.12). */
  metrics(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  private async acceptValid(
    manager: EntityManager,
    binding: IntakeBinding,
    envelope: CanonicalEnvelope,
    receivedAt: Date,
  ): Promise<AcceptResult> {
    assertBinding(binding, envelope);
    const identity = identityOf(envelope);
    const rawId = randomUUID();
    const registration = await registerIdentity(manager, identity, {
      rawId,
      receivedAt,
    });
    const replayRunId = envelope.provenance.replayRunId ?? null;
    if (!registration.fresh && !replayRunId) {
      return this.repeatedDelivery(manager, envelope, registration.rawId);
    }
    return this.retain(manager, envelope, {
      version: versionOf(envelope, { rawId, receivedAt }),
      replayRunId,
      originalRawId: registration.fresh ? null : registration.rawId,
    });
  }

  /** Decides the outcome, appends the raw row and requests normalisation when needed. */
  private async retain(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    input: {
      version: VersionRow;
      replayRunId: string | null;
      originalRawId: string | null;
    },
  ): Promise<AcceptResult> {
    const { version, replayRunId } = input;
    const outcome = await this.decide(manager, envelope, version, replayRunId);
    await insertRaw(
      manager,
      rawRowOf(envelope, {
        version,
        outcome,
        originalRawId: input.originalRawId,
      }),
    );
    if (outcome === 'conflict') {
      await this.recordConflict(manager, envelope, version);
    }
    const ticket = NORMALIZED.has(outcome)
      ? await this.requestNormalization(manager, envelope, {
          rawId: version.rawId,
          receivedAt: version.receivedAt,
          replayRunId,
        })
      : null;
    return {
      status: outcome,
      rawId: version.rawId,
      sourceObjectId: envelope.sourceObjectId,
      ticket,
    };
  }

  /** Ordering against the stored version; a replay never changes the latest version. */
  private async decide(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    version: VersionRow,
    replayRunId: string | null,
  ): Promise<RawOutcome> {
    const key = objectKeyOf(envelope);
    if (await insertIfNew(manager, key, version)) return 'accepted';
    const stored = await lockObject(manager, key);
    const decision: OrderingDecision | 'replayed' = replayRunId
      ? 'replayed'
      : decideOrdering(
          {
            hash: stored.latestHash,
            observedAt: stored.latestObservedAt,
            revision: stored.latestRevision,
          },
          version,
        );
    if (decision === 'revision')
      await advanceVersion(manager, stored.id, version);
    else await touchObject(manager, stored.id);
    return decision;
  }

  /**
   * A message id seen before: counted, no raw row. If the object's latest version never became
   * canonical (quarantined), the redelivery retries it (ING05 retry count = exception occurrences).
   */
  private async repeatedDelivery(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    firstRawId: string,
  ): Promise<AcceptResult> {
    await countDuplicateDelivery(manager, identityOf(envelope));
    const stored = await findLockedObject(manager, objectKeyOf(envelope));
    const pending =
      stored?.latestRawId === firstRawId &&
      stored.normalizedRawId !== stored.latestRawId;
    const ticket = pending
      ? await this.requestNormalization(manager, envelope, {
          rawId: stored.latestRawId,
          receivedAt: stored.latestReceivedAt,
          replayRunId: null,
        })
      : null;
    return {
      status: 'duplicate',
      rawId: firstRawId,
      sourceObjectId: envelope.sourceObjectId,
      ticket,
    };
  }

  private async requestNormalization(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    raw: { rawId: string; receivedAt: Date; replayRunId: string | null },
  ): Promise<NormalizationTicket> {
    const payload = {
      rawId: raw.rawId,
      receivedAt: raw.receivedAt.toISOString(),
      tenantId: envelope.tenantId,
      connectionId: envelope.connectionId,
      sourceObjectId: envelope.sourceObjectId,
      replayRunId: raw.replayRunId,
    };
    const [id] = await enqueueOutbox(manager, [
      {
        tenantId: envelope.tenantId,
        aggregateType: 'source_object',
        aggregateId:
          `${envelope.connectionId}:${envelope.sourceObjectId}`.slice(0, 128),
        type: 'RawAccepted',
        payload,
        scope: envelope.connectionId,
      },
    ]);
    return { key: normalizationKey(id), ...payload };
  }

  private async recordConflict(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    version: VersionRow,
  ): Promise<void> {
    await recordException(manager, {
      ...objectKeyOf(envelope),
      rawId: version.rawId,
      rawReceivedAt: version.receivedAt,
      errorCode: 'order_conflict',
      detail: {
        reason:
          'Different content with the same observation time and no comparable source revision; the stored version was kept',
        observedAt: envelope.observedAt,
        sourceRevision: envelope.sourceRevision ?? null,
      },
    });
  }

  /** Schema-invalid deliveries are retained and quarantined when their identity is usable (FND01). */
  private async acceptInvalid(
    manager: EntityManager,
    binding: IntakeBinding,
    input: {
      candidate: unknown;
      violations: EnvelopeViolation[];
      receivedAt: Date;
    },
  ): Promise<AcceptResult> {
    const row = invalidRawRow(binding, input);
    const registration = await registerIdentity(manager, identityOfRow(row), {
      rawId: row.id,
      receivedAt: row.receivedAt,
    });
    if (!registration.fresh) {
      await countDuplicateDelivery(manager, identityOfRow(row));
      return {
        status: 'duplicate',
        rawId: registration.rawId,
        sourceObjectId: row.sourceObjectId,
        ticket: null,
      };
    }
    await this.quarantineInvalid(manager, row, input.violations);
    return {
      status: 'invalid',
      rawId: row.id,
      sourceObjectId: row.sourceObjectId,
      ticket: null,
    };
  }

  private async quarantineInvalid(
    manager: EntityManager,
    row: RawObservation,
    violations: EnvelopeViolation[],
  ): Promise<void> {
    await insertRaw(manager, row);
    await recordException(manager, {
      tenantId: row.tenantId,
      connectionId: row.connectionId,
      sourceObjectId: row.sourceObjectId,
      rawId: row.id,
      rawReceivedAt: row.receivedAt,
      errorCode: 'schema_invalid',
      detail: { violations: violations.slice(0, 50) },
    });
    this.logger.warn(
      `Schema-invalid envelope ${row.messageId} quarantined (${violations.length} violation(s))`,
    );
  }
}

/** Inbox key of the normalisation requested by outbox message `outboxId`. */
export function normalizationKey(outboxId: string): string {
  return `normalize:${outboxId}`;
}

function assertBinding(
  binding: IntakeBinding,
  envelope: CanonicalEnvelope,
): void {
  if (
    envelope.tenantId === binding.tenantId &&
    envelope.connectionId === binding.connectionId
  ) {
    return;
  }
  throw new ForbiddenException({
    code: 'ENVELOPE_BINDING_MISMATCH',
    message: 'The envelope tenant/connection differs from the adapter binding',
  });
}

function identityOf(envelope: CanonicalEnvelope): DeliveryIdentity {
  return {
    tenantId: envelope.tenantId,
    connectionId: envelope.connectionId,
    messageId: envelope.messageId,
  };
}

function identityOfRow(row: {
  tenantId: string;
  connectionId: string;
  messageId: string;
}): DeliveryIdentity {
  return {
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    messageId: row.messageId,
  };
}

function objectKeyOf(envelope: CanonicalEnvelope): ObjectKey {
  return {
    tenantId: envelope.tenantId,
    connectionId: envelope.connectionId,
    sourceObjectId: envelope.sourceObjectId,
  };
}

function versionOf(
  envelope: CanonicalEnvelope,
  raw: { rawId: string; receivedAt: Date },
): VersionRow {
  return {
    ...raw,
    hash: contentHashOf(envelope),
    observedAt: new Date(envelope.observedAt),
    revision: envelope.sourceRevision ?? null,
    kind: envelope.kind,
    retracted: envelope.operation === 'retract',
  };
}
