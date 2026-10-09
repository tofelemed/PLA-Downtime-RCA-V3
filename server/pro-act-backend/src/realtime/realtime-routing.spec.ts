import { RequestContext } from '../common/context/request-context';
import { OutboxFeedRow, routeOutboxRow, windowOf } from './realtime-message';
import { roomsForContext, tenantRoom, unitRoom } from './realtime-rooms';

const T = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const U2 = '33333333-3333-4333-8333-333333333333';

const context = (overrides: Partial<RequestContext>): RequestContext => ({
  userId: 'u',
  tenantId: T,
  organizationId: null,
  legacyRole: 'Operator',
  roles: [],
  scopes: [],
  isSuperAdmin: false,
  correlationId: 'c',
  ...overrides,
});

const row = (overrides: Partial<OutboxFeedRow>): OutboxFeedRow => ({
  id: '42',
  tenant_id: T,
  aggregate_type: 'production_event',
  aggregate_id: 'e1',
  type: 'EventChanged',
  version: 3,
  payload: {},
  created_at: '2026-10-09T06:00:00.000Z',
  ...overrides,
});

describe('realtime rooms (plan 3.1)', () => {
  it('tenant-wide identities join the tenant room; unit-limited ones only their unit rooms', () => {
    expect(roomsForContext(context({}))).toEqual([tenantRoom(T)]);
    expect(roomsForContext(context({ isSuperAdmin: true }))).toEqual([
      tenantRoom(T),
    ]);
    const unitOnly = context({
      scopes: [
        { kind: 'unit', id: U1, role: 'viewer', tenantId: T },
        { kind: 'unit', id: U2, role: 'operator', tenantId: T },
        { kind: 'unit', id: U1, role: 'operator', tenantId: T },
      ],
    });
    expect(roomsForContext(unitOnly)).toEqual([
      unitRoom(T, U1),
      unitRoom(T, U2),
    ]);
    expect(roomsForContext(context({ tenantId: null }))).toEqual([]);
  });

  it('routes a unit message to the tenant room and the unit room, scope narrowed per room', () => {
    const routed = routeOutboxRow(row({ payload: { unitId: U1 } }));
    expect(routed.map((m) => m.room)).toEqual([tenantRoom(T), unitRoom(T, U1)]);
    expect(routed[1].scope).toEqual({ tenantId: T, unitIds: [U1] });
    expect(routed[0]).toMatchObject({
      seq: '42',
      domainEventId: 'outbox:42',
      revision: 3,
      entityId: 'e1',
    });
    expect(routed[0]).not.toHaveProperty('payload');
  });

  it('a message without a unit reaches the tenant room only; multi-unit messages each unit room', () => {
    expect(routeOutboxRow(row({})).map((m) => m.room)).toEqual([tenantRoom(T)]);
    const multi = routeOutboxRow(row({ payload: { unitIds: [U1, U2, 'x'] } }));
    expect(multi.map((m) => m.room)).toEqual([
      tenantRoom(T),
      unitRoom(T, U1),
      unitRoom(T, U2),
    ]);
    expect(multi[0].scope.unitIds).toEqual([U1, U2]);
    expect(multi[2].scope.unitIds).toEqual([U2]);
  });

  it('keeps the domain event id, skips intake traffic and rows without a tenant', () => {
    const id = '44444444-4444-4444-8444-444444444444';
    expect(
      routeOutboxRow(row({ payload: { domainEventId: id } }))[0].domainEventId,
    ).toBe(id);
    expect(routeOutboxRow(row({ type: 'RawAccepted' }))).toEqual([]);
    expect(routeOutboxRow(row({ tenant_id: 'nope' }))).toEqual([]);
  });

  it('reads the touched window from the known payload fields', () => {
    expect(windowOf({ affectedFrom: 'a', affectedTo: null })).toEqual({
      from: 'a',
      to: null,
    });
    expect(windowOf({ utcStart: 'a', utcEnd: 'b' })).toEqual({
      from: 'a',
      to: 'b',
    });
    expect(windowOf({})).toBeNull();
  });
});
