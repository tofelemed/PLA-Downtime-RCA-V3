import './support/use-test-database';
import { INestApplication, Type } from '@nestjs/common';
import { APP_GUARD, ModulesContainer } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { WriteAccessGuard } from '../../src/auth/guards/write-access.guard';
import { configureHttpApp } from '../../src/common/http/configure-http-app';
import {
  inventoryRoutes,
  routeKey,
  RouteGuardEntry,
} from '../../src/common/security/route-guard-inventory';
import { IntegrationHarness } from './harness';
import {
  PUBLIC_ROUTE_ALLOWLIST,
  READ_ONLY_ALLOWED_ROUTES,
} from './support/route-allowlists';
import { seedEventWorld } from './support/seed-event-world';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `/api[/v2]/<path>` with every `:param` (and wildcard) replaced by a fresh uuid. */
function concretePath(entry: RouteGuardEntry): string {
  const path = entry.path
    .replace(/:[A-Za-z0-9_]+/g, () => randomUUID())
    .replace(/\*/g, 'x');
  return `/api${entry.version ? `/v${entry.version}` : ''}${path}`;
}

/**
 * T14 / plan 3.11: WriteAccessGuard covers every mutating route. The inventory enumerates every route the
 * application registers; a viewer's POST / PUT / PATCH / DELETE to each one that is neither public nor
 * reviewed read-only must be refused with 403 before any handler runs.
 */
describe('write access coverage for read-only callers (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let entries: RouteGuardEntry[];
  let viewerToken: string;
  let previousRegistration: string | undefined;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = '100000';
    // production setting: `register` is an admin route (the dev .env may open it)
    previousRegistration = process.env.AUTH_ALLOW_PUBLIC_REGISTRATION;
    process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = 'false';
    await harness.start();
    const world = await seedEventWorld(harness.dataSource);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureHttpApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
    entries = inventoryRoutes(registeredControllers(app), {
      globalGuard: true,
    });
    viewerToken = await viewerIn(world.tenantA);
  });

  afterAll(async () => {
    delete process.env.THROTTLE_LIMIT;
    if (previousRegistration === undefined) {
      delete process.env.AUTH_ALLOW_PUBLIC_REGISTRATION;
    } else {
      process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = previousRegistration;
    }
    await app?.close();
    await harness.stop();
  });

  async function viewerIn(tenantId: string): Promise<string> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'viewer', $2, 'x', 'viewer', $3)`,
      [id, `${id}@test.local`, tenantId],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, 'viewer', 1)`,
      [tenantId, id],
    );
    return app.get(JwtService).sign({
      sub: id,
      email: `${id}@test.local`,
      role: 'viewer',
      tenantId,
      typ: 'access',
    });
  }

  it('registers WriteAccessGuard as a global guard of AppModule', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as unknown[];
    expect(providers).toContainEqual({
      provide: APP_GUARD,
      useClass: WriteAccessGuard,
    });
  });

  it('marks only the reviewed routes @ReadOnlyAllowed()', () => {
    const marked = entries
      .filter((entry) => entry.readOnlyAllowed)
      .map(routeKey);
    expect(new Set(marked)).toEqual(READ_ONLY_ALLOWED_ROUTES);
  });

  it('refuses every other mutating route to a viewer with 403', async () => {
    const targets = entries.filter(
      (entry) =>
        MUTATING.has(entry.method) &&
        !entry.readOnlyAllowed &&
        !PUBLIC_ROUTE_ALLOWLIST.has(routeKey(entry)),
    );
    expect(targets.length).toBeGreaterThan(150);
    // routes inherited from a base controller are probed too (v2 code libraries)
    expect(targets.map(routeKey)).toEqual(
      expect.arrayContaining([
        'OeeCodesV2Controller.create',
        'OeeCodesV2Controller.change',
        'ReasonCodesV2Controller.retire',
      ]),
    );
    const accepted: string[] = [];
    for (const entry of targets) {
      const method = entry.method.toLowerCase() as
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';
      const response = await request(app.getHttpServer())
        [method](concretePath(entry))
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({});
      if (response.status !== 403) {
        accepted.push(
          `${entry.method} ${entry.path} (${routeKey(entry)}) → ${response.status}`,
        );
      }
    }
    expect(accepted).toEqual([]);
  });
});

function registeredControllers(app: INestApplication): Array<Type<unknown>> {
  return [...app.get(ModulesContainer).values()]
    .flatMap((module) => [...module.controllers.values()])
    .map((wrapper) => wrapper.metatype)
    .filter(
      (metatype): metatype is Type<unknown> => typeof metatype === 'function',
    );
}
