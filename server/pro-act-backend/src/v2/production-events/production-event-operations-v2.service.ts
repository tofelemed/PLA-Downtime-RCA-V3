import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { BulkCodeService } from '../../event-operations/bulk-code.service';
import {
  ATOMIC_BULK_LIMIT,
  BulkCodeApplied,
  BulkCodeCommand,
  BulkCodePreview,
} from '../../event-operations/bulk-code.types';
import { BulkJobService } from '../../event-operations/bulk-job.service';
import { EventCommandService } from '../../event-operations/event-command.service';
import { OperationOutcome } from '../../event-operations/operation-support';
import { JobAccepted } from '../common/response';
import { EventReferencesValidator } from './event-references.validator';
import {
  BulkCodeV2Dto,
  CloseEventV2Dto,
  MergeEventsV2Dto,
  RetractEventV2Dto,
  SplitEventV2Dto,
} from './event-operations-v2.dto';
import {
  BulkJobView,
  EventOperationView,
  toBulkJobView,
} from './event-operation.view';
import { ProductionEventsV2Service } from './production-events-v2.service';
import { bulkReasonWeights } from './reason-weight-columns';

/** Result of `POST /production-events/bulk-code`: a preview, an atomic apply, or an accepted job. */
export type BulkCodeOutcome =
  | { kind: 'preview'; body: BulkCodePreview }
  | { kind: 'applied'; body: BulkCodeApplied }
  | { kind: 'job'; body: JobAccepted };

/** v2 adapter of the plan 1.4 event operations: DTO → command, references, result views. */
@Injectable()
export class ProductionEventOperationsV2Service {
  constructor(
    private readonly commands: EventCommandService,
    private readonly bulkCode: BulkCodeService,
    private readonly jobs: BulkJobService,
    private readonly references: EventReferencesValidator,
    private readonly reads: ProductionEventsV2Service,
  ) {}

  async split(
    context: RequestContext,
    eventId: string,
    expectedVersion: number,
    dto: SplitEventV2Dto,
  ): Promise<EventOperationView> {
    const outcome = await this.commands.split(context, eventId, {
      splitAt: new Date(dto.splitAt),
      reason: dto.reason,
      expectedVersion,
    });
    return this.view(context, outcome);
  }

  async merge(
    context: RequestContext,
    dto: MergeEventsV2Dto,
  ): Promise<EventOperationView> {
    const outcome = await this.commands.merge(context, {
      events: dto.events,
      maxGapSeconds: dto.maxGapSeconds ?? 0,
      overrideClassification: dto.overrideClassification ?? false,
      reason: dto.reason,
    });
    return this.view(context, outcome);
  }

  async close(
    context: RequestContext,
    eventId: string,
    expectedVersion: number,
    dto: CloseEventV2Dto,
  ): Promise<EventOperationView> {
    const outcome = await this.commands.close(context, eventId, {
      endTime: new Date(dto.endTime),
      reason: dto.reason,
      expectedVersion,
    });
    return this.view(context, outcome);
  }

  async retract(
    context: RequestContext,
    eventId: string,
    expectedVersion: number,
    dto: RetractEventV2Dto,
  ): Promise<EventOperationView> {
    const outcome = await this.commands.retract(context, eventId, {
      reason: dto.reason,
      expectedVersion,
    });
    return this.view(context, outcome);
  }

  /** Preview, atomic apply (≤ 500 events) or a job for larger batches (API04). */
  async bulkCodeCommand(
    context: RequestContext,
    dto: BulkCodeV2Dto,
  ): Promise<BulkCodeOutcome> {
    const tenantId = requireTenantId(context);
    const { reasonWeights, ...codes } = dto.codes;
    const command: BulkCodeCommand = {
      items: dto.items,
      codes: reasonWeights
        ? { ...codes, ...bulkReasonWeights(reasonWeights, codes.reasonCodeId) }
        : codes,
      reason: dto.reason,
    };
    assertSomeCode(command);
    if (command.codes.reasonCodeId) {
      await this.references.assertReasonCodeOwned(
        tenantId,
        command.codes.reasonCodeId,
      );
    }
    await this.references.assertReasonCodesOwned(
      tenantId,
      (command.codes.reasonWeights ?? []).map((w) => w.reasonCodeId),
      'codes.reasonWeights',
    );
    if (dto.preview) {
      return {
        kind: 'preview',
        body: await this.bulkCode.preview(context, command),
      };
    }
    if (command.items.length <= ATOMIC_BULK_LIMIT) {
      return {
        kind: 'applied',
        body: await this.bulkCode.apply(context, command),
      };
    }
    const job = await this.bulkCode.enqueue(context, command);
    return {
      kind: 'job',
      body: { jobId: job.id, statusUrl: `/api/v2/jobs/${job.id}` },
    };
  }

  async job(context: RequestContext, jobId: string): Promise<BulkJobView> {
    return toBulkJobView(await this.jobs.get(context, jobId));
  }

  private async view(
    context: RequestContext,
    outcome: OperationOutcome,
  ): Promise<EventOperationView> {
    const ids = [...outcome.createdEventIds, ...outcome.updatedEventIds];
    const events = await Promise.all(
      ids.map((id) => this.reads.get(context, id)),
    );
    return { ...outcome, events };
  }
}

function assertSomeCode(command: BulkCodeCommand): void {
  const {
    reasonCodeId,
    scheduleClass,
    oeeComponent,
    assetId,
    investigationPending,
  } = command.codes;
  const some =
    reasonCodeId ||
    scheduleClass ||
    oeeComponent ||
    assetId ||
    investigationPending !== undefined;
  if (!some) {
    const message =
      'codes must set reasonCodeId, scheduleClass, oeeComponent, assetId or investigationPending';
    throw new UnprocessableEntityException({
      code: 'NO_CODES',
      message: [message],
      fieldErrors: [{ field: 'codes', message }],
    });
  }
}
