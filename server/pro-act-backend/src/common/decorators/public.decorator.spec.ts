import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPublicRoute, Public, PublicIf } from './public.decorator';

const FLAG = 'TEST_PUBLIC_IF_FLAG';

class Controller {
  @Public()
  open(): void {}

  @PublicIf(FLAG)
  conditional(): void {}

  closed(): void {}
}

function contextFor(
  handler: keyof Controller,
  authorization?: string,
): ExecutionContext {
  return {
    getHandler: (): unknown =>
      Object.getOwnPropertyDescriptor(Controller.prototype, handler)
        ?.value as unknown,
    getClass: () => Controller,
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('isPublicRoute', () => {
  const reflector = new Reflector();
  afterEach(() => {
    delete process.env[FLAG];
  });

  it('is public for @Public() regardless of a token, never for an undecorated handler', () => {
    expect(isPublicRoute(reflector, contextFor('open', 'Bearer x'))).toBe(true);
    expect(isPublicRoute(reflector, contextFor('closed'))).toBe(false);
  });

  it('opens a @PublicIf() route only while its flag is true', () => {
    expect(isPublicRoute(reflector, contextFor('conditional'))).toBe(false);
    process.env[FLAG] = 'true';
    expect(isPublicRoute(reflector, contextFor('conditional'))).toBe(true);
  });

  it('treats a request carrying a bearer token as protected even while the flag is true', () => {
    process.env[FLAG] = 'true';
    expect(
      isPublicRoute(reflector, contextFor('conditional', 'Bearer abc.def.ghi')),
    ).toBe(false);
    expect(isPublicRoute(reflector, contextFor('conditional', 'Bearer '))).toBe(
      true,
    );
    expect(
      isPublicRoute(reflector, contextFor('conditional', 'Basic abc')),
    ).toBe(true);
  });
});
