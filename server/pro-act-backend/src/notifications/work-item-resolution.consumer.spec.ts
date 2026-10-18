import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import {
  RESOLUTION_COALESCE_MS,
  WorkItemResolutionConsumer,
} from './work-item-resolution.consumer';
import { WorkItemResolver } from './work-item-resolver';

const message = (
  type: string,
  tenantId: string,
  payload: Record<string, unknown> = {},
): PublishedMessage =>
  ({
    id: '1',
    tenantId,
    type,
    aggregateId: 'x',
    payload,
  }) as unknown as PublishedMessage;

describe('WorkItemResolutionConsumer', () => {
  let bus: InProcessEventBus;
  let resolve: jest.Mock<Promise<number>, [string]>;
  let consumer: WorkItemResolutionConsumer;

  beforeEach(() => {
    jest.useFakeTimers();
    bus = new InProcessEventBus();
    resolve = jest.fn<Promise<number>, [string]>().mockResolvedValue(1);
    consumer = new WorkItemResolutionConsumer(
      bus,
      { resolve } as unknown as WorkItemResolver,
      new ShutdownCoordinator(),
    );
    consumer.onModuleInit();
  });

  afterEach(() => {
    consumer.onModuleDestroy();
    jest.useRealTimers();
  });

  it('coalesces a burst of coding and period messages into one resolution per plant', async () => {
    await bus.dispatch(message('EventChanged', 'tenant-a'));
    await bus.dispatch(message('EventChanged', 'tenant-a'));
    await bus.dispatch(message('PeriodApproved', 'tenant-a'));
    await bus.dispatch(message('EventRetracted', 'tenant-b'));
    expect(resolve).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(RESOLUTION_COALESCE_MS);
    expect(resolve.mock.calls.map(([tenant]) => tenant).sort()).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
  });

  it('ignores verification-only messages and unrelated types', async () => {
    await bus.dispatch(
      message('EventChanged', 'tenant-a', { workflowOnly: true }),
    );
    await bus.dispatch(message('PlanVersionApproved', 'tenant-a'));
    await jest.advanceTimersByTimeAsync(RESOLUTION_COALESCE_MS);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('a failed resolution is logged, never thrown into the relay', async () => {
    resolve.mockRejectedValueOnce(new Error('db down'));
    await expect(consumer.resolveNow('tenant-a')).resolves.toBe(0);
  });
});
