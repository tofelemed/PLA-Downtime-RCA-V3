import { EntityManager } from 'typeorm';
import { ProductionEvent } from '../production-event.entity';
import { isWorkflowOnly } from './event-change.notifier';
import { EventRevision } from './event-revision.entity';
import { appendWorkflowRevisions } from './workflow-revision';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ACTOR = {
  id: '22222222-2222-4222-8222-222222222222',
  kind: 'user' as const,
};

const event = (id: string, endTime: Date | null): ProductionEvent =>
  ({
    id,
    tenantId: TENANT,
    unitId: 'unit-1',
    startTime: new Date('2026-01-01T06:00:00Z'),
    endTime,
  }) as ProductionEvent;

/** A manager answering the event read and the revision-number read; records the insert. */
function fakeManager(
  events: ProductionEvent[],
  maxima: Record<string, number>,
) {
  const insert = jest.fn().mockResolvedValue({ identifiers: [] });
  const query = jest.fn().mockResolvedValue(
    Object.entries(maxima).map(([eventId, max]) => ({
      event_id: eventId,
      max: String(max),
    })),
  );
  const manager = {
    getRepository: () => ({ findBy: jest.fn().mockResolvedValue(events) }),
    query,
    insert,
  } as unknown as EntityManager;
  return { manager, insert, query };
}

describe('appendWorkflowRevisions (SME D13 labels as revisions)', () => {
  it('writes one numbered user revision per event in a single insert and returns workflow-only messages', async () => {
    const closed = event('e-1', new Date('2026-01-01T07:00:00Z'));
    const open = event('e-2', null);
    const { manager, insert, query } = fakeManager([closed, open], {
      'e-1': 4,
    });

    const messages = await appendWorkflowRevisions(manager, ['e-1', 'e-2'], {
      actor: ACTOR,
      reason: 'verification',
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    const [entity, rows] = insert.mock.calls[0] as [
      unknown,
      Array<Record<string, unknown>>,
    ];
    expect(entity).toBe(EventRevision);
    expect(rows).toEqual([
      expect.objectContaining({
        eventId: 'e-1',
        revision: 5,
        kind: 'user',
        changeReason: 'verification',
        actorId: ACTOR.id,
      }),
      expect.objectContaining({
        eventId: 'e-2',
        revision: 1,
        kind: 'user',
        actorKind: 'user',
      }),
    ]);
    expect(messages).toEqual([
      expect.objectContaining({
        eventId: 'e-1',
        revision: 5,
        workflowOnly: true,
        affectedTo: '2026-01-01T07:00:00.000Z',
      }),
      expect.objectContaining({
        eventId: 'e-2',
        revision: 1,
        workflowOnly: true,
        affectedTo: null,
      }),
    ]);
  });

  it('does nothing for an empty selection', async () => {
    const { manager, insert, query } = fakeManager([], {});
    await expect(
      appendWorkflowRevisions(manager, [], {
        actor: ACTOR,
        reason: 'failure_validation',
      }),
    ).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('flags only workflow-only payloads for the recalculating consumers', () => {
    expect(isWorkflowOnly({ workflowOnly: true })).toBe(true);
    expect(isWorkflowOnly({ kind: 'user' })).toBe(false);
  });
});
