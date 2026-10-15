import {
  ExecutionContext,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class FixtureController {
  @Public()
  open(this: void): void {}

  closed(this: void): void {}
}

function contextFor(
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => FixtureController,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', path: '/fixture' }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const context = contextFor(FixtureController.prototype.closed);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(true);
  });

  it('turns a missing token into a 401 instead of a plain Error (500)', () => {
    const attempt = () =>
      guard.handleRequest(null, false, new Error('No auth token'), context);

    expect(attempt).toThrow(UnauthorizedException);
    expect(attempt).toThrow('No auth token');
  });

  it('turns passport info objects (expired, bad signature) into a 401', () => {
    const attempt = () =>
      guard.handleRequest(
        null,
        null,
        { name: 'TokenExpiredError', message: 'jwt expired' },
        context,
      );

    expect(attempt).toThrow(UnauthorizedException);
    expect(attempt).toThrow('jwt expired');
  });

  it('reports an unavailable identity lookup as 503 without exposing internal details', () => {
    const failure = new Error('connect ECONNREFUSED private-database:5432');
    const attempt = () => guard.handleRequest(failure, null, null, context);
    expect(attempt).toThrow(ServiceUnavailableException);
    expect(attempt).toThrow('Authentication service temporarily unavailable');
    expect(attempt).not.toThrow('private-database');
  });

  it('keeps a dropped identity connection distinct from invalid credentials', () => {
    expect(() =>
      guard.handleRequest(
        new Error('Connection terminated unexpectedly'),
        null,
        null,
        context,
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('re-throws explicit authentication and policy HttpExceptions untouched', () => {
    const inactive = new UnauthorizedException('Account is inactive');
    expect(() => guard.handleRequest(inactive, null, null, context)).toThrow(
      inactive,
    );
    expect(() =>
      guard.handleRequest(new ForbiddenException('nope'), null, null, context),
    ).toThrow(ForbiddenException);
  });

  it('returns the authenticated user', () => {
    const user = { userId: 'u1', email: 'a@b.c', role: 'Analyst' };
    expect(guard.handleRequest(null, user, null, context)).toBe(user);
  });

  it('lets @Public() handlers through without consulting passport', async () => {
    expect(
      await guard.canActivate(contextFor(FixtureController.prototype.open)),
    ).toBe(true);
  });
});
