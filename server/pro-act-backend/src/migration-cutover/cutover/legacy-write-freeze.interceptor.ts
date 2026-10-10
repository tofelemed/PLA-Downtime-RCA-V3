import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { getRequestContext } from '../../common/context/request-context';
import { RequestWithContext } from '../../common/context/request-context.middleware';

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

/** v2 resources and authentication stay writable during a freeze; everything else under /api is v1. */
export function isFreezableV1Path(path: string): boolean {
  if (!path.startsWith('/api/')) return false;
  return !/^\/api\/(v2|auth)(\/|$)/.test(path);
}

/**
 * MIG05 step 1 (plan 3.10): while the acting tenant has an active row in `legacy_write_freezes`, every
 * v1 POST / PUT / PATCH / DELETE answers 423 `LEGACY_WRITES_FROZEN` with a pointer to the v2 API.
 * Runs as an interceptor (after the guard chain bound the tenant). One indexed lookup per v1 write, no
 * cache: the freeze is set by the cutover script in another process and must hold immediately.
 */
@Injectable()
export class LegacyWriteFreezeInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (executionContext.getType() !== 'http') return next.handle();
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    if (!MUTATING_METHODS.has(request.method)) return next.handle();
    if (!isFreezableV1Path(request.path)) return next.handle();
    const tenantId = (request.requestContext ?? getRequestContext())?.tenantId;
    if (!tenantId || !(await this.isFrozen(tenantId))) return next.handle();
    throw new HttpException(
      {
        code: 'LEGACY_WRITES_FROZEN',
        message:
          'v1 writes of this plant are frozen for the cutover to v2; use the v2 screens (/api/v2) or wait until the freeze is released.',
      },
      HttpStatus.LOCKED,
    );
  }

  private async isFrozen(tenantId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "legacy_write_freezes" WHERE "tenant_id" = $1 AND "released_at" IS NULL LIMIT 1`,
      [tenantId],
    );
    return rows.length > 0;
  }
}
