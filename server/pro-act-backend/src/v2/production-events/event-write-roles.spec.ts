import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { EventReviewItemsV2Controller } from '../event-review-items/event-review-items-v2.controller';
import { StopIncidentsV2Controller } from '../stop-events/stop-incidents-v2.controller';
import { STOP_DECISION_ROLES } from '../stop-events/stop-event-roles';
import { EVENT_WRITERS } from './event-write-roles';
import { ProductionEventOperationsV2Controller } from './production-event-operations-v2.controller';
import { ProductionEventsV2Controller } from './production-events-v2.controller';

type Controller = { prototype: object };

const WRITES: ReadonlyArray<[Controller, string]> = [
  [ProductionEventsV2Controller, 'create'],
  [ProductionEventsV2Controller, 'patch'],
  [ProductionEventOperationsV2Controller, 'merge'],
  [ProductionEventOperationsV2Controller, 'bulkCode'],
  [ProductionEventOperationsV2Controller, 'split'],
  [ProductionEventOperationsV2Controller, 'close'],
  [ProductionEventOperationsV2Controller, 'retract'],
  [EventReviewItemsV2Controller, 'resolve'],
  [StopIncidentsV2Controller, 'mark'],
  [StopIncidentsV2Controller, 'clear'],
];

function rolesOf(controller: Controller, handler: string): unknown {
  const method: unknown = Object.getOwnPropertyDescriptor(
    controller.prototype,
    handler,
  )?.value;
  return Reflect.getMetadata(ROLES_KEY, method as object);
}

describe('event writers (owner decision 2026-10-19: read-only coding for the production accountant)', () => {
  it('names operators, production engineers, reliability engineers and manager approvers only', () => {
    expect([...EVENT_WRITERS]).toEqual([
      'operator',
      'production_engineer',
      'reliability_engineer',
      'manager_approver',
    ]);
    expect(EVENT_WRITERS).not.toContain('production_accountant');
    expect(EVENT_WRITERS).not.toContain('viewer');
  });

  it.each(WRITES)('%p.%s requires an event writer', (controller, handler) => {
    expect(rolesOf(controller, handler)).toEqual([...EVENT_WRITERS]);
  });

  it('duplicate-stop decisions and their inbox item use the same set', () => {
    expect(STOP_DECISION_ROLES).toBe(EVENT_WRITERS);
  });
});
