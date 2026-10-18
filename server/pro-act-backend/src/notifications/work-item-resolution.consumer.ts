import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { isWorkflowOnly } from '../production-event/revisions/event-change.notifier';
import { WORKFLOW_EVENTS } from '../reconciliation/workflow-recorder';
import { WorkItemResolver } from './work-item-resolver';

/** Domain messages after which a shared work item may be done: a stop coded / ended / retracted, a period step. */
export const RESOLVING_MESSAGES: readonly string[] = [
  'EventChanged',
  'EventRetracted',
  WORKFLOW_EVENTS.submitted,
  WORKFLOW_EVENTS.approved,
  WORKFLOW_EVENTS.rejected,
  WORKFLOW_EVENTS.revised,
  WORKFLOW_EVENTS.cancelled,
  WORKFLOW_EVENTS.stale,
];

/** Bursts of messages of one plant (a bulk coding, a source refresh) resolve once, this long after the first. */
export const RESOLUTION_COALESCE_MS = 1_000;

/**
 * Event-driven trigger of `WorkItemResolver` (owner 18 Oct): after a message that can finish shared work the
 * plant's open work notifications are re-checked, so a reminder another person already acted on leaves every
 * bell within seconds. Messages of one plant are coalesced (one resolution per `RESOLUTION_COALESCE_MS`)
 * so the relay is never held up; resolution is idempotent and `WorkItemResolutionJob` sweeps behind it, so a
 * failed or skipped run only delays the cleanup.
 */
@Injectable()
export class WorkItemResolutionConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WorkItemResolutionConsumer.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly bus: InProcessEventBus,
    private readonly resolver: WorkItemResolver,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  onModuleInit(): void {
    for (const type of RESOLVING_MESSAGES) {
      this.bus.subscribe(type, (message) => this.onMessage(message));
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  onMessage(message: PublishedMessage): Promise<void> {
    if (!isWorkflowOnly(message.payload)) this.schedule(message.tenantId);
    return Promise.resolve();
  }

  /** Runs the plant's resolution now (tests, and the coalesced timer). */
  async resolveNow(tenantId: string): Promise<number> {
    this.timers.delete(tenantId);
    if (this.shutdown.isShuttingDown) return 0;
    try {
      return await this.shutdown.track(this.resolver.resolve(tenantId));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Work item resolution of ${tenantId} failed: ${reason}`);
      return 0;
    }
  }

  private schedule(tenantId: string): void {
    if (this.timers.has(tenantId)) return;
    const timer = setTimeout(() => {
      void this.resolveNow(tenantId);
    }, RESOLUTION_COALESCE_MS);
    timer.unref();
    this.timers.set(tenantId, timer);
  }
}
