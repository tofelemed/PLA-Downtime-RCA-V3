import { EntityManager } from 'typeorm';
import {
  CASE_LIST_FACTS_SQL,
  caseListFacts,
  toListFacts,
} from './rca-case-list-facts';
import {
  RECOMMENDATION_EVENT_FACTS_SQL,
  recommendationEventFacts,
} from './recommendation-event-facts';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rcaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const unitId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const managerReturning = (rows: unknown[]) => {
  const query = jest.fn().mockResolvedValue(rows);
  return { manager: { query } as unknown as EntityManager, query };
};

describe('RCA list facts (UX U3: trigger and action counts on GET /v2/rcas)', () => {
  it('reads trigger and counts of a whole page in one query', async () => {
    const { manager, query } = managerReturning([
      {
        rca_id: rcaId,
        event_id: eventId,
        start_time: new Date('2026-10-17T22:15:00Z'),
        unit_id: unitId,
        total: 3,
        done: 1,
        overdue: 1,
      },
    ]);
    const facts = await caseListFacts(
      manager,
      { tenantId, units: [unitId], userId: null },
      [rcaId, 'other'],
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(CASE_LIST_FACTS_SQL, [
      tenantId,
      [rcaId, 'other'],
      [unitId],
    ]);
    expect(facts.get(rcaId)).toEqual({
      trigger: { eventId, startTime: '2026-10-17T22:15:00.000Z', unitId },
      actions: { total: 3, done: 1, overdue: 1 },
    });
  });

  it('answers a case without linked event or actions with null and zeros', () => {
    expect(toListFacts(undefined)).toEqual({
      trigger: null,
      actions: { total: 0, done: 0, overdue: 0 },
    });
    expect(
      toListFacts({
        rca_id: rcaId,
        event_id: null,
        start_time: null,
        unit_id: null,
        total: 0,
        done: 0,
        overdue: 0,
      }).trigger,
    ).toBeNull();
  });

  it('runs no query for an empty page', async () => {
    const { manager, query } = managerReturning([]);
    const facts = await caseListFacts(
      manager,
      { tenantId, units: null, userId: null },
      [],
    );
    expect(facts.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('counts cancelled actions out of the total and uses the shared overdue rule', () => {
    expect(CASE_LIST_FACTS_SQL).toContain(`a."status"::text <> 'cancelled'`);
    expect(CASE_LIST_FACTS_SQL).toContain(
      `a."due_date" + interval '1 day' <= now()`,
    );
    expect(CASE_LIST_FACTS_SQL).toContain('ORDER BY k."linked_at", k."id"');
  });
});

describe('recommendation event facts (UX F-1)', () => {
  it('reads reason, asset and start of the events of a page in one query', async () => {
    const { manager, query } = managerReturning([
      {
        id: eventId,
        reason_code_id: rcaId,
        reason_name: 'Bearing failure',
        asset_id: unitId,
        asset_name: 'Extruder 1',
        start_time: '2026-10-17T22:15:00Z',
        physical_type: 'downtime',
      },
    ]);
    const facts = await recommendationEventFacts(manager, tenantId, [
      eventId,
      eventId,
    ]);
    expect(query).toHaveBeenCalledWith(RECOMMENDATION_EVENT_FACTS_SQL, [
      tenantId,
      [eventId],
    ]);
    expect(facts.get(eventId)).toEqual({
      reasonCodeId: rcaId,
      reasonName: 'Bearing failure',
      assetId: unitId,
      assetName: 'Extruder 1',
      startTime: '2026-10-17T22:15:00.000Z',
      physicalType: 'downtime',
    });
  });
});
