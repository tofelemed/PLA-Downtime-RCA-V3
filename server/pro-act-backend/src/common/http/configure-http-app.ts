import { INestApplication, VersioningType } from '@nestjs/common';
import { Server } from 'http';
import { ApiExceptionFilter } from '../filters/api-exception.filter';
import { createValidationPipe } from '../validation/validation-pipe.factory';

export const API_GLOBAL_PREFIX = 'api';
/** Plan 3.11 (NFR02 request limits): JSON / form bodies; uploads have their own 25 MiB limit. */
export const JSON_BODY_LIMIT = '1mb';

interface BodyParserHost {
  useBodyParser(
    type: string,
    options: { limit: string; extended?: boolean },
  ): unknown;
}

function hasBodyParser(app: unknown): app is BodyParserHost {
  return typeof (app as Partial<BodyParserHost>).useBodyParser === 'function';
}

interface ExpressSettingsHost {
  disable(setting: string): unknown;
}

function hasExpressSettings(app: unknown): app is ExpressSettingsHost {
  return typeof (app as Partial<ExpressSettingsHost>).disable === 'function';
}

/**
 * Idle keep-alive above the usual load-balancer / nginx idle timeout (60 s), so the proxy never reuses a
 * socket Node has just closed (sporadic 502s with Node's 5 s default; perf audit P14). `headersTimeout` must
 * exceed it. `HTTP_KEEP_ALIVE_TIMEOUT_MS` overrides.
 */
export function keepAliveTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env.HTTP_KEEP_ALIVE_TIMEOUT_MS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 65_000;
}

function configureServerTimeouts(app: INestApplication): void {
  const server: unknown = app.getHttpServer();
  if (!(server instanceof Server)) return;
  server.keepAliveTimeout = keepAliveTimeoutMs();
  server.headersTimeout = server.keepAliveTimeout + 1_000;
}

/**
 * HTTP conventions shared by `main.ts` and the integration-test harness: `/api` prefix, URI versioning
 * (`@Controller({ version: '2' })` → `/api/v2/...`), the API03 error filter, the global validation pipe
 * and the request body limits (413 above 1 MiB); no `X-Powered-By` header, keep-alive above the proxy's.
 */
export function configureHttpApp<T extends INestApplication>(app: T): T {
  if (hasExpressSettings(app)) app.disable('x-powered-by');
  configureServerTimeouts(app);
  if (hasBodyParser(app)) {
    app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
    app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });
  }
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(createValidationPipe());
  return app;
}
