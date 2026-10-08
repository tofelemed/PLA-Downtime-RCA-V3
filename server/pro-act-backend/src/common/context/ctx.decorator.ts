import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context.middleware';
import {
  anonymousContext,
  getRequestContext,
  RequestContext,
} from './request-context';

/**
 * Injects the resolved `RequestContext` into a handler parameter:
 * `list(@Ctx() ctx: RequestContext)`. Prefers the context bound to the request, then the ambient
 * store; an anonymous context is returned on public routes.
 */
export const Ctx = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): RequestContext => {
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    return (
      request.requestContext ??
      getRequestContext() ??
      anonymousContext(String(request.headers?.['x-correlation-id'] ?? ''))
    );
  },
);
