import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { getRequestContext } from '../../common/context/request-context';
import { RequestWithContext } from '../../common/context/request-context.middleware';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import {
  canViewMoney,
  MONEY_NOT_VISIBLE,
  moneyNotVisible,
} from './money-access';
import { MONEY_FIELDS_KEY, MONEY_ONLY_KEY } from './money.decorators';
import { withoutMoney } from './money-redaction';

/**
 * Global interceptor (QA re-test decision 2026-10-19, "Money is withheld on the server for operators"):
 * for a caller without the money capability (`canViewMoney`), a `@MoneyOnly()` route answers 403
 * MONEY_NOT_VISIBLE (audited like any denial) and every other response leaves its money out
 * (`withoutMoney`, plus the route's `@MoneyFields` keys). Callers with the capability are untouched.
 */
@Injectable()
export class MoneyRedactionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly denials: AccessDenialAuditService,
  ) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (executionContext.getType() !== 'http') return next.handle();
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    const context = request.requestContext ?? getRequestContext();
    if (!context?.userId || canViewMoney(context)) return next.handle();
    const targets = [
      executionContext.getHandler(),
      executionContext.getClass(),
    ];
    if (this.reflector.getAllAndOverride<boolean>(MONEY_ONLY_KEY, targets)) {
      this.denials.record(context, {
        reason: MONEY_NOT_VISIBLE,
        entityType: 'Route',
        entityId: `${request.method} ${request.path}`,
        method: request.method,
        path: request.path,
      });
      throw moneyNotVisible();
    }
    const keys =
      this.reflector.getAllAndMerge<string[]>(MONEY_FIELDS_KEY, targets) ?? [];
    return next
      .handle()
      .pipe(
        map((body: unknown) =>
          body instanceof StreamableFile ? body : withoutMoney(body, keys),
        ),
      );
  }
}
