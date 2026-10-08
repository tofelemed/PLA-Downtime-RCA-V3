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
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AuthModule } from '../../../src/auth/auth.module';
import { CommonModule } from '../../../src/common/common.module';
import { configureHttpApp } from '../../../src/common/http/configure-http-app';
import { CorrelationIdMiddleware } from '../../../src/common/http/correlation-id.middleware';
import { UserIpThrottlerGuard } from '../../../src/common/throttling/user-ip-throttler.guard';
import { RealtimeModule } from '../../../src/realtime/realtime.module';
import { IntegrationHarness } from '../harness';

export interface IntegrationAppOptions {
  /** feature modules under test; auth, realtime, common and TypeORM are always present */
  modules: Array<Type<unknown> | DynamicModule>;
  /** requests per minute before 429; generous by default so suites never trip it by accident */
  throttleLimit?: number;
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
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
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
      TypeOrmModule.forRoot({ ...connection, migrationsRun: false }),
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
      RealtimeModule,
      AuthModule,
      ...options.modules,
    ],
    providers: [{ provide: APP_GUARD, useClass: UserIpThrottlerGuard }],
  }).compile();

  const app = configureHttpApp(
    moduleRef.createNestApplication({ logger: false }),
  );
  await app.init();
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
  });
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
