import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { resolveCorrelationId } from '../http/correlation-id';
import {
  anonymousContext,
  RequestContext,
  runWithRequestContext,
} from './request-context';

/** Express request carrying the resolved context for code that has the request but not the store. */
export interface RequestWithContext extends Request {
  requestContext?: RequestContext;
}

/**
 * Enters an anonymous request context for the rest of the request (guards, interceptors, handler,
 * services). `JwtStrategy.validate` fills in the identity later via `bindRequestContext()`.
 * Must run after CorrelationIdMiddleware so the context carries the resolved correlation id.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const context = anonymousContext(resolveCorrelationId(request, response));
    request.requestContext = context;
    runWithRequestContext(context, () => next());
  }
}
