import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { RealtimeGateway } from '../../src/realtime.gateway';
import { ScopedRealtimeModule } from '../../src/realtime/scoped-realtime.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

type Middleware = (socket: Socket, next: (error?: Error) => void) => void;

/** A connected client of the fake server: rooms joined and events received. */
class FakeClient {
  readonly id = randomUUID();
  readonly rooms = new Set<string>([this.id]);
  readonly data: Record<string, unknown> = {};
  readonly received: Array<[string, unknown]> = [];
  connected = true;
  constructor(readonly handshake: { auth: unknown }) {}
  join(rooms: string | string[]): void {
    for (const room of Array.isArray(rooms) ? rooms : [rooms])
      this.rooms.add(room);
  }
  disconnect(): void {
    this.connected = false;
  }
  asSocket(): Socket {
    return this as unknown as Socket;
  }
}

/** `server.use` and `server.to(rooms).emit` with Socket.IO semantics (one delivery per socket). */
class FakeServer {
  readonly clients = new Set<FakeClient>();
  middleware: Middleware | null = null;
  use(fn: Middleware): this {
    this.middleware = fn;
    return this;
  }
  to(rooms: string | string[]) {
    const targets = Array.isArray(rooms) ? rooms : [rooms];
    return {
      emit: (event: string, payload: unknown) => {
        for (const client of this.clients) {
          if (
            client.connected &&
            targets.some((room) => client.rooms.has(room))
          ) {
            client.received.push([event, payload]);
          }
        }
        return true;
      },
    };
  }
}

/**
 * Plan 3.11 (known issue: the v1 `/socket.io` gateway accepted anonymous clients and broadcast to
 * everyone): the handshake needs an access token, a socket joins only its tenant / unit rooms, and a v1
 * entity broadcast reaches only the entity's tenant (and unit); clients can no longer join rooms.
 */
describe('legacy /socket.io gateway scope (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let gateway: RealtimeGateway;
  const server = new FakeServer();
  let adminA = '';

  const handshake = (auth: unknown): Promise<FakeClient | string> =>
    new Promise((resolve) => {
      const client = new FakeClient({ auth });
      server.middleware!(client.asSocket(), (error?: Error) => {
        if (error) {
          resolve(error.message);
          return;
        }
        server.clients.add(client);
        gateway.handleConnection(client.asSocket());
        resolve(client);
      });
    });
  const connect = async (auth: unknown): Promise<FakeClient> => {
    const result = await handshake(auth);
    if (typeof result === 'string') throw new Error(`refused: ${result}`);
    return result;
  };

  beforeAll(async () => {
    process.env.REALTIME_FEED_ENABLED = 'false';
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, ScopedRealtimeModule],
    });
    gateway = app.get(RealtimeGateway);
    gateway.server = server as unknown as Server;
    gateway.afterInit(server as unknown as Server);
    adminA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    delete process.env.REALTIME_FEED_ENABLED;
    await app?.close();
    await harness.stop();
  });

  it('refuses handshakes without a valid access token or with a foreign tenant', async () => {
    expect(await handshake(undefined)).toBe('UNAUTHENTICATED');
    expect(await handshake({ token: 'not-a-jwt' })).toBe('UNAUTHENTICATED');
    const refreshLike = app
      .get(JwtService)
      .sign({ sub: randomUUID(), tenantId: world.tenantA, typ: 'refresh' });
    expect(await handshake({ token: refreshLike })).toBe('UNAUTHENTICATED');
    const userB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
    });
    expect(await handshake({ token: userB, tenantId: world.tenantA })).toBe(
      'FORBIDDEN',
    );
  });

  it('delivers an entity broadcast only to its tenant and unit rooms', async () => {
    const a = await connect({ token: adminA });
    const b = await connect({
      token: signToken(app, {
        userId: randomUUID(),
        tenantId: world.tenantB,
        role: 'TenantAdmin',
      }),
    });
    const unitUserId = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'u', $2, 'x', 'viewer', $3)`,
      [unitUserId, `${unitUserId}@test.local`, world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'viewer', 1)`,
      [world.tenantA, unitUserId, world.unitA2],
    );
    const unitA2Only = await connect({
      token: signToken(app, {
        userId: unitUserId,
        tenantId: world.tenantA,
        role: 'viewer',
      }),
    });

    gateway.broadcastEntityEvent('Updated', 'productionEvent', {
      id: 'e',
      tenantId: world.tenantA,
      unitId: world.unitA1,
    });
    gateway.broadcastEntityEvent('Updated', 'productionEvent', {
      id: 'no-tenant',
    });

    expect(a.received).toEqual([
      [
        'productionEventUpdated',
        { id: 'e', tenantId: world.tenantA, unitId: world.unitA1 },
      ],
    ]);
    expect(b.received).toEqual([]);
    expect(unitA2Only.received).toEqual([]);
  });

  it('pushes a v1 event change to the event tenant only, and offers no room-join message', async () => {
    const a = await connect({ token: adminA });
    const b = await connect({
      token: signToken(app, {
        userId: randomUUID(),
        tenantId: world.tenantB,
        role: 'TenantAdmin',
      }),
    });
    await request(app.getHttpServer())
      .put(`/api/production-events/${world.events.e1}`)
      .set(bearer(adminA))
      .send({ description: 'pushed' })
      .expect(200);
    expect(a.received.map(([event]) => event)).toContain(
      'productionEventUpdated',
    );
    expect(b.received).toEqual([]);
    const prototype = Object.getOwnPropertyNames(RealtimeGateway.prototype);
    expect(prototype).not.toContain('handleJoinEntityRoom');
  });
});
