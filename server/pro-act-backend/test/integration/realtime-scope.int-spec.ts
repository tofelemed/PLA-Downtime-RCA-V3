import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Socket } from 'socket.io';
import * as request from 'supertest';
import { enqueueOutbox } from '../../src/common/outbox/outbox-writer';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import {
  credentialsOf,
  RealtimeAuthenticator,
} from '../../src/realtime/realtime-authenticator';
import { RealtimeFeedService } from '../../src/realtime/realtime-feed.service';
import { RealtimeMessage } from '../../src/realtime/realtime-message';
import { tenantRoom, unitRoom } from '../../src/realtime/realtime-rooms';
import {
  ScopedRealtimeGateway,
  SubscribeAck,
} from '../../src/realtime/scoped-realtime.gateway';
import { ScopedRealtimeModule } from '../../src/realtime/scoped-realtime.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** In-memory stand-in for a connected Socket.IO client: rooms, received messages, disconnects. */
class FakeSocket {
  readonly id = randomUUID();
  readonly rooms = new Set<string>([this.id]);
  readonly data: Record<string, unknown> = {};
  readonly received: RealtimeMessage[] = [];
  readonly events: Array<[string, unknown]> = [];
  connected = true;

  join(rooms: string | string[]): void {
    for (const room of Array.isArray(rooms) ? rooms : [rooms])
      this.rooms.add(room);
  }
  leave(room: string): void {
    this.rooms.delete(room);
  }
  emit(event: string, payload: unknown): boolean {
    if (event === 'realtime.message')
      this.received.push(payload as RealtimeMessage);
    else this.events.push([event, payload]);
    return true;
  }
  disconnect(): void {
    this.connected = false;
  }
  asSocket(): Socket {
    return this as unknown as Socket;
  }
}

/** Room fan-out with the semantics of `server.to(room).emit` over the fake sockets. */
class FakeHub {
  readonly sockets = new Set<FakeSocket>();
  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        for (const socket of this.sockets) {
          if (socket.connected && socket.rooms.has(room))
            socket.emit(event, payload);
        }
        return true;
      },
    };
  }
}

/**
 * Plan 3.1 T23 (server side) — scoped realtime: sockets authenticate with the JWT and join only the rooms
 * of their RequestContext; a message reaches its tenant room and its unit room, so tenant B and a user
 * limited to another unit never receive it; every tab of a tenant gets each message once; a client that
 * missed messages resumes from the room buffer or is told to resync; re-subscribing follows grant changes.
 */
describe('scoped realtime channel (plan 3.1)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let gateway: ScopedRealtimeGateway;
  let feed: RealtimeFeedService;
  let auth: RealtimeAuthenticator;
  const hub = new FakeHub();
  let adminA = '';
  let adminB = '';
  let unitUser = '';
  let unitUserId = '';

  const connect = async (token: string, tenantId?: string) => {
    const socket = new FakeSocket();
    socket.data.session = await auth.authenticate(
      credentialsOf({ token, tenantId }),
    );
    hub.sockets.add(socket);
    gateway.handleConnection(socket.asSocket());
    return socket;
  };

  const outbox = (tenantId: string, payload: Record<string, unknown>) =>
    harness.dataSource.transaction((manager) =>
      enqueueOutbox(manager, [
        {
          tenantId,
          aggregateType: 'test_aggregate',
          aggregateId: randomUUID(),
          type: 'TestChanged',
          payload,
        },
      ]),
    );

  const patchEvent = async (id: string, description: string) => {
    const http = request(app.getHttpServer());
    const current = await http
      .get(`/api/v2/production-events/${id}`)
      .set(bearer(adminA))
      .expect(200);
    await http
      .patch(`/api/v2/production-events/${id}`)
      .set(bearer(adminA))
      .set('If-Match', String(current.headers.etag))
      .send({ description })
      .expect(200);
  };

  beforeAll(async () => {
    process.env.REALTIME_FEED_ENABLED = 'false';
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module, ScopedRealtimeModule],
    });
    gateway = app.get(ScopedRealtimeGateway);
    feed = app.get(RealtimeFeedService);
    auth = app.get(RealtimeAuthenticator);
    gateway.server = hub as unknown as ScopedRealtimeGateway['server'];
    adminA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    unitUserId = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit user', $2, 'x', 'Operator', $3)`,
      [unitUserId, `${unitUserId}@test.local`, world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'viewer', 1)`,
      [world.tenantA, unitUserId, world.unitA1],
    );
    unitUser = signToken(app, {
      userId: unitUserId,
      tenantId: world.tenantA,
      role: 'Operator',
    });
    await feed.pollOnce();
  });

  afterAll(async () => {
    delete process.env.REALTIME_FEED_ENABLED;
    await app?.close();
    await harness.stop();
  });

  it('refuses missing, forged or foreign-tenant credentials', async () => {
    await expect(auth.authenticate(credentialsOf({}))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(
      auth.authenticate(credentialsOf({ token: 'not-a-jwt' })),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const forged = `${adminA.slice(0, -4)}AAAA`;
    await expect(
      auth.authenticate(credentialsOf({ token: forged })),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(
      auth.authenticate(
        credentialsOf({ token: unitUser, tenantId: world.tenantB }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('joins the rooms of the request context only', async () => {
    const a = await connect(adminA);
    const u = await connect(unitUser);
    const b = await connect(adminB);
    expect([...a.rooms].filter((r) => r !== a.id)).toEqual([
      tenantRoom(world.tenantA),
    ]);
    expect([...u.rooms].filter((r) => r !== u.id)).toEqual([
      unitRoom(world.tenantA, world.unitA1),
    ]);
    expect([...b.rooms].filter((r) => r !== b.id)).toEqual([
      tenantRoom(world.tenantB),
    ]);
    const ready = u.events.find(
      ([event]) => event === 'realtime.ready',
    )?.[1] as SubscribeAck;
    expect(ready.rooms.map((r) => r.room)).toEqual([
      unitRoom(world.tenantA, world.unitA1),
    ]);
    for (const socket of [a, u, b]) hub.sockets.delete(socket);
  });

  it('T23: an event change reaches every tab of its tenant once, never tenant B or another unit', async () => {
    const tab1 = await connect(adminA);
    const tab2 = await connect(adminA);
    const unitA1 = await connect(unitUser);
    const tenantB = await connect(adminB);
    await patchEvent(world.events.e1, 'realtime A1');
    await outbox(world.tenantA, { unitId: world.unitA3 });
    await outbox(world.tenantA, {});
    await outbox(world.tenantB, { unitId: world.unitB1 });
    expect(await feed.pollOnce()).toBeGreaterThan(0);

    for (const tab of [tab1, tab2]) {
      const changed = tab.received.filter((m) => m.type === 'EventChanged');
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({
        entityId: world.events.e1,
        scope: { unitIds: [world.unitA1] },
      });
      expect(changed[0].window?.from).toBeDefined();
      expect(tab.received.filter((m) => m.type === 'TestChanged')).toHaveLength(
        2,
      );
      expect(
        tab.received.every((m) => m.scope.tenantId === world.tenantA),
      ).toBe(true);
      expect(new Set(tab.received.map((m) => m.domainEventId)).size).toBe(
        tab.received.length,
      );
    }
    expect(unitA1.received.map((m) => m.type)).toEqual(['EventChanged']);
    expect(unitA1.received[0].scope.unitIds).toEqual([world.unitA1]);
    expect(tenantB.received.map((m) => m.scope.tenantId)).toEqual([
      world.tenantB,
    ]);
    expect(JSON.stringify(tenantB.received)).not.toContain(world.tenantA);
    expect(JSON.stringify(unitA1.received)).not.toContain(world.unitA3);
    for (const socket of [tab1, tab2, unitA1, tenantB])
      hub.sockets.delete(socket);
  });

  it('T23: after a disconnect the client resumes from its last seq or is told to resync', async () => {
    const room = unitRoom(world.tenantA, world.unitA1);
    const first = await connect(unitUser);
    await outbox(world.tenantA, { unitId: world.unitA1 });
    await feed.pollOnce();
    const lastSeen = first.received[first.received.length - 1];
    expect(lastSeen.room).toBe(room);
    first.disconnect();

    await outbox(world.tenantA, { unitId: world.unitA1 });
    await outbox(world.tenantA, { unitId: world.unitA1 });
    await feed.pollOnce();
    expect(first.received[first.received.length - 1].seq).toBe(lastSeen.seq);

    const resumed = await connect(unitUser);
    const ack = await gateway.handleSubscribe(resumed.asSocket(), {
      sinceSeq: { [room]: lastSeen.seq },
    });
    expect(ack).toMatchObject({ resync: [], replayed: 2 });
    expect(resumed.received.map((m) => m.prevSeq)).toEqual([
      lastSeen.seq,
      resumed.received[0].seq,
    ]);

    const stale = await connect(unitUser);
    const staleAck = (await gateway.handleSubscribe(stale.asSocket(), {
      sinceSeq: { [room]: '0' },
    })) as SubscribeAck;
    expect(staleAck.resync).toEqual([room]);
    expect(stale.received).toEqual([]);
    for (const socket of [first, resumed, stale]) hub.sockets.delete(socket);
  });

  it('re-subscribing follows a grant change: the old unit room is left', async () => {
    const socket = await connect(unitUser);
    await harness.dataSource.query(
      `UPDATE user_scopes SET scope_id = $2 WHERE user_id = $1`,
      [unitUserId, world.unitA3],
    );
    try {
      const ack = (await gateway.handleSubscribe(
        socket.asSocket(),
        {},
      )) as SubscribeAck;
      expect(ack.rooms.map((r) => r.room)).toEqual([
        unitRoom(world.tenantA, world.unitA3),
      ]);
      expect(socket.rooms.has(unitRoom(world.tenantA, world.unitA1))).toBe(
        false,
      );
      await outbox(world.tenantA, { unitId: world.unitA1 });
      await feed.pollOnce();
      expect(socket.received).toEqual([]);
    } finally {
      await harness.dataSource.query(
        `UPDATE user_scopes SET scope_id = $2 WHERE user_id = $1`,
        [unitUserId, world.unitA1],
      );
      hub.sockets.delete(socket);
    }
  });

  it('an invalid session on re-subscribe disconnects the socket', async () => {
    const socket = await connect(unitUser);
    (
      socket.data.session as { credentials: { token: string } }
    ).credentials.token = 'expired';
    const ack = await gateway.handleSubscribe(socket.asSocket(), {});
    expect(ack).toEqual({ error: 'UNAUTHENTICATED' });
    expect(socket.connected).toBe(false);
    hub.sockets.delete(socket);
  });
});
