import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import {
  anonymousContext,
  RequestContext,
} from '../../common/context/request-context';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { MoneyFields, MoneyOnly } from './money.decorators';
import { MoneyRedactionInterceptor } from './money-redaction.interceptor';

class Routes {
  @MoneyOnly()
  valueReport(): void {}

  @MoneyFields('cost')
  events(): void {}

  plain(): void {}
}

function contextFor(
  handler: () => void,
  requestContext: RequestContext,
): ExecutionContext {
  const request = { method: 'GET', path: '/api/v2/x', requestContext };
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const caller = (roles: string[]): RequestContext => ({
  ...anonymousContext('c'),
  userId: 'u',
  tenantId: 't',
  roles,
});
const body = {
  items: [
    { id: 'e1', cost: '100', values: [{ currency: 'USD', amount: '9' }] },
  ],
};
const handlerReturning = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('MoneyRedactionInterceptor', () => {
  const record = jest.fn();
  const interceptor = new MoneyRedactionInterceptor(new Reflector(), {
    record,
  } as unknown as AccessDenialAuditService);
  const handler = (name: keyof Routes): (() => void) =>
    Reflect.get(Routes.prototype, name);

  beforeEach(() => record.mockReset());

  it('passes the response unchanged for a caller with the money capability', async () => {
    const out = interceptor.intercept(
      contextFor(handler('events'), caller(['finance_approver'])),
      handlerReturning(body),
    );
    expect(await firstValueFrom(out)).toBe(body);
  });

  it('leaves money and the route keys out for an operator', async () => {
    const out = interceptor.intercept(
      contextFor(handler('events'), caller(['operator'])),
      handlerReturning(body),
    );
    expect(await firstValueFrom(out)).toEqual({ items: [{ id: 'e1' }] });
  });

  it('applies the shared rule on routes without route keys', async () => {
    const out = interceptor.intercept(
      contextFor(handler('plain'), caller(['operator'])),
      handlerReturning(body),
    );
    expect(await firstValueFrom(out)).toEqual({
      items: [{ id: 'e1', cost: '100' }],
    });
  });

  it('refuses a money-only route with 403 MONEY_NOT_VISIBLE and audits the denial', () => {
    const handle = jest.fn();
    expect(() =>
      interceptor.intercept(
        contextFor(handler('valueReport'), caller(['operator'])),
        { handle },
      ),
    ).toThrow(ForbiddenException);
    expect(handle).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u' }),
      expect.objectContaining({ reason: 'MONEY_NOT_VISIBLE' }),
    );
  });

  it('streams files through untouched', async () => {
    const file = new StreamableFile(Buffer.from('a,b'));
    const out = interceptor.intercept(
      contextFor(handler('plain'), caller(['operator'])),
      handlerReturning(file),
    );
    expect(await firstValueFrom(out)).toBe(file);
  });
});
