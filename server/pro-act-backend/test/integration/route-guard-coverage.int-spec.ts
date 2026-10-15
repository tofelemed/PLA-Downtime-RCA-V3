import './support/use-test-database';
import { INestApplication, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  findUnprotectedRoutes,
  inventoryRoutes,
  routeKey,
  RouteGuardEntry,
} from '../../src/common/security/route-guard-inventory';
import { CodeLibraryV2Controller } from '../../src/v2/code-libraries/code-library-v2.controller';
import { IntegrationHarness } from './harness';
import { PUBLIC_ROUTE_ALLOWLIST } from './support/route-allowlists';

/**
 * Literal routes declared after a parameter route of the same controller that matches them, so Express
 * never reaches them. None: the last one (`POST /historian/history/recreate`) left with the retired v1
 * historian-history routes.
 */
const KNOWN_SHADOWED: string[] = [];

/** `a` (declared earlier) matches every path of `b`: same method, segments equal or `a` has a parameter. */
function shadows(a: RouteGuardEntry, b: RouteGuardEntry): boolean {
  const as = a.path.split('/');
  const bs = b.path.split('/');
  if (a.method !== b.method || as.length !== bs.length || a.path === b.path) {
    return false;
  }
  return (
    as.every((seg, i) => seg.startsWith(':') || seg === bs[i]) &&
    bs.some((seg, i) => as[i].startsWith(':') && !seg.startsWith(':'))
  );
}

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

  it('inventories the routes the v2 code libraries inherit from their base controller', () => {
    const libraries = registeredControllers().filter(
      (controller) => controller.prototype instanceof CodeLibraryV2Controller,
    );
    expect(libraries).toHaveLength(5);
    const shared = new Set(
      Object.getOwnPropertyNames(CodeLibraryV2Controller.prototype),
    );
    const entries = inventoryRoutes(libraries, { globalGuard: true }).filter(
      (entry) => shared.has(entry.handler),
    );
    // 7 shared routes (list, get, versions, references, create, change, retire) per library
    expect(entries).toHaveLength(35);
    expect(
      entries.every(
        (entry) =>
          entry.version === '2' &&
          entry.guarded &&
          !entry.isPublic &&
          !entry.readOnlyAllowed,
      ),
    ).toBe(true);
    expect(entries.map((entry) => `${entry.method} ${entry.path}`)).toEqual(
      expect.arrayContaining([
        'PUT /oee-codes/:id',
        'POST /reason-codes/:id/retire',
        'GET /failure-code-groups/:id/versions',
      ]),
    );
  });

  it('declares literal routes before the parameter routes that would shadow them', () => {
    const entries = inventoryRoutes(registeredControllers(), {
      globalGuard: true,
    });
    const shadowed = entries.filter((entry, index) =>
      entries
        .slice(0, index)
        .some(
          (earlier) =>
            earlier.controller === entry.controller && shadows(earlier, entry),
        ),
    );
    expect(shadowed.map(routeKey)).toEqual(KNOWN_SHADOWED);
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
