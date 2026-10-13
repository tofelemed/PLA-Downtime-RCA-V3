import 'reflect-metadata';
import {
  DynamicModule,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  Type,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Logger } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AccessModule } from '../../../src/auth/access/access.module';
import { AuthModule } from '../../../src/auth/auth.module';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { ScopeGuard } from '../../../src/auth/guards/scope.guard';
import { TenantBindingGuard } from '../../../src/auth/guards/tenant-binding.guard';
import { WriteAccessGuard } from '../../../src/auth/guards/write-access.guard';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import { Clock } from '../../../src/common/clock/clock';
import { CommonModule } from '../../../src/common/common.module';
import { RequestContextMiddleware } from '../../../src/common/context/request-context.middleware';
import { configureHttpApp } from '../../../src/common/http/configure-http-app';
import { CorrelationIdMiddleware } from '../../../src/common/http/correlation-id.middleware';
import { IdempotencyInterceptor } from '../../../src/common/idempotency/idempotency.interceptor';
import { IdempotencyModule } from '../../../src/common/idempotency/idempotency.module';
import { UserIpThrottlerGuard } from '../../../src/common/throttling/user-ip-throttler.guard';
import { RealtimeModule } from '../../../src/realtime/realtime.module';
import { installTenantSessionBinding } from '../../../src/database/rls/tenant-session-binding';
import { IntegrationHarness } from '../harness';

export interface IntegrationAppOptions {
  /** feature modules under test; auth, realtime, common and TypeORM are always present */
  modules: Array<Type<unknown> | DynamicModule>;
  /** requests per minute before 429; generous by default so suites never trip it by accident */
  throttleLimit?: number;
  /** receives every SQL statement the app runs (scoped-query assertions) */
  onQuery?: (sql: string) => void;
  /**
   * Row-level-security tenant binding (plan 3.11): on, like production, unless `DB_RLS_TENANT_BINDING=false`.
   */
  rlsBinding?: boolean;
}

export interface TestIdentity {
  userId: string;
  tenantId?: string;
  organizationId?: string;
  role?: string;
  email?: string;
}

@Module({})
class HttpConventionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, RequestContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

/**
 * "Now" of the test app: after every fixture date (the worlds use 2027), so manual events are never in
 * the future (DT-09); a test of the future-time check writes after this instant.
 */
export const TEST_NOW = new Date('2030-01-01T00:00:00.000Z');

function fixedClock(now: Date): Clock {
  return { now: () => new Date(now) };
}

/**
 * Boots a Nest application with the production HTTP conventions (`/api` prefix, URI versioning,
 * ApiExceptionFilter, global ValidationPipe, correlation ids, throttler) on the harness database.
 */
export async function createIntegrationApp(
  harness: IntegrationHarness,
  options: IntegrationAppOptions,
): Promise<INestApplication> {
  const connection = harness.dataSource.options as PostgresConnectionOptions;
  const moduleRef = await Test.createTestingModule({
    imports: [
      HttpConventionsModule,
      TypeOrmModule.forRoot({
        ...connection,
        migrationsRun: false,
        ...(options.onQuery ? sqlCapture(options.onQuery) : {}),
      }),
      ThrottlerModule.forRoot({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: options.throttleLimit ?? 100_000,
          },
        ],
      }),
      CommonModule,
      AccessModule,
      IdempotencyModule,
      RealtimeModule,
      AuthModule,
      ...options.modules,
    ],
    // Same global chain as AppModule: rate limit, authentication, @Roles, @ScopeParam, read-only roles,
    // @TenantBound, idempotency
    providers: [
      { provide: APP_GUARD, useClass: UserIpThrottlerGuard },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: ScopeGuard },
      { provide: APP_GUARD, useClass: WriteAccessGuard },
      { provide: APP_GUARD, useClass: TenantBindingGuard },
      { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    ],
  })
    .overrideProvider(Clock)
    .useValue(fixedClock(TEST_NOW))
    .compile();

  const app = configureHttpApp(
    moduleRef.createNestApplication({ logger: false }),
  );
  await app.init();
  if (options.rlsBinding ?? process.env.DB_RLS_TENANT_BINDING !== 'false') {
    installTenantSessionBinding(app.get(DataSource));
  }
  return app;
}

/** Signs an access token exactly as AuthService does (`JwtStrategy.validate` needs no user row). */
export function signToken(
  app: INestApplication,
  identity: TestIdentity,
): string {
  return app.get(JwtService).sign({
    sub: identity.userId,
    email: identity.email ?? `${identity.userId}@test.local`,
    role: identity.role ?? 'Analyst',
    tenantId: identity.tenantId,
    organizationId: identity.organizationId,
    typ: 'access',
  });
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** TypeORM options that route every executed statement to `onQuery`. */
function sqlCapture(onQuery: (sql: string) => void): {
  logging: ['query'];
  logger: Logger;
} {
  const ignore = (): void => undefined;
  return {
    logging: ['query'],
    logger: {
      logQuery: (sql: string) => onQuery(sql),
      logQueryError: ignore,
      logQuerySlow: ignore,
      logSchemaBuild: ignore,
      logMigration: ignore,
      log: ignore,
    },
  };
}
