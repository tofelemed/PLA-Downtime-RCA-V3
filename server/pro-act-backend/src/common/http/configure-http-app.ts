import { INestApplication, VersioningType } from '@nestjs/common';
import { ApiExceptionFilter } from '../filters/api-exception.filter';
import { createValidationPipe } from '../validation/validation-pipe.factory';

export const API_GLOBAL_PREFIX = 'api';

/**
 * HTTP conventions shared by `main.ts` and the integration-test harness: `/api` prefix, URI versioning
 * (`@Controller({ version: '2' })` → `/api/v2/...`), the API03 error filter and the global validation pipe.
 */
export function configureHttpApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(createValidationPipe());
  return app;
}
