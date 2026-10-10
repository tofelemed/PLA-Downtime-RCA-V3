import { INestApplication, VersioningType } from '@nestjs/common';
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

/**
 * HTTP conventions shared by `main.ts` and the integration-test harness: `/api` prefix, URI versioning
 * (`@Controller({ version: '2' })` → `/api/v2/...`), the API03 error filter, the global validation pipe
 * and the request body limits (413 above 1 MiB).
 */
export function configureHttpApp<T extends INestApplication>(app: T): T {
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
