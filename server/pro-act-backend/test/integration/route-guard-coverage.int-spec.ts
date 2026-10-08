import './support/use-test-database';
import { INestApplication, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  findUnprotectedRoutes,
  inventoryRoutes,
  routeKey,
} from '../../src/common/security/route-guard-inventory';
import { IntegrationHarness } from './harness';

/**
 * Every route the application registers is guarded (global `JwtAuthGuard`), except these explicitly
 * public ones (`@Public()` AND listed here). `register` is `@PublicIf('AUTH_ALLOW_PUBLIC_REGISTRATION')`,
 * so it stays guarded by default. Adding a public route is a deliberate, reviewed change to this list.
 */
export const PUBLIC_ROUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  'AuthController.login',
  'AuthController.refresh',
  'AuthController.logout',
  'AuthController.validateToken',
  'HealthController.check',
  'HealthController.detailedCheck',
]);

/** Controllers that had no guard at the 0.1 baseline (B14). */
const FORMERLY_UNGUARDED = [
  'UnmappedEventController',
  'RCARecommendationController',
  'DashboardConfigurationController',
  'FileUploadController',
];

describe('route guard coverage (B14, plan 0.4)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;

  beforeAll(async () => {
    await harness.start();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  function registeredControllers(): Array<Type<unknown>> {
    return [...app.get(ModulesContainer).values()]
      .flatMap((module) => [...module.controllers.values()])
      .map((wrapper) => wrapper.metatype)
      .filter(
        (metatype): metatype is Type<unknown> => typeof metatype === 'function',
      );
  }

  it('guards every registered route or lists it as public', () => {
    const entries = inventoryRoutes(registeredControllers(), {
      globalGuard: true,
    });
    expect(entries.length).toBeGreaterThan(300);

    const unprotected = findUnprotectedRoutes(entries, PUBLIC_ROUTE_ALLOWLIST);
    expect(
      unprotected.map(
        (entry) => `${entry.method} ${entry.path} (${routeKey(entry)})`,
      ),
    ).toEqual([]);

    const publicRoutes = entries
      .filter((entry) => entry.isPublic && !entry.guarded)
      .map(routeKey);
    expect(new Set(publicRoutes)).toEqual(new Set(PUBLIC_ROUTE_ALLOWLIST));
  });

  it('closes the controllers that were unguarded at the baseline', () => {
    const entries = inventoryRoutes(registeredControllers(), {
      globalGuard: true,
    });
    for (const controller of FORMERLY_UNGUARDED) {
      const routes = entries.filter((entry) => entry.controller === controller);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every((entry) => entry.guarded)).toBe(true);
    }
  });

  it('exposes the v2 reference endpoint under its own version', () => {
    const entries = inventoryRoutes(registeredControllers(), {
      globalGuard: true,
    });
    const v2 = entries.filter((entry) => entry.version === '2');
    expect(v2.map((entry) => `${entry.method} ${entry.path}`)).toContain(
      'GET /production-events',
    );
    expect(v2.every((entry) => entry.guarded)).toBe(true);
  });
});
