import {
  BadRequestException,
  HttpException,
  HttpStatus,
  PreconditionFailedException,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ETagInterceptor } from './etag.interceptor';
import { assertRevision, formatETag, parseIfMatch } from './revision';

describe('revision helpers (API02)', () => {
  it('formats a strong quoted ETag', () => {
    expect(formatETag(3)).toBe('"3"');
  });

  it.each<[string | string[], number]>([
    ['"7"', 7],
    ['7', 7],
    ['W/"7"', 7],
    [['"2"', '"9"'], 2],
  ])('parses If-Match %p', (header, expected) => {
    expect(parseIfMatch(header)).toBe(expected);
  });

  it.each([undefined, '', '  '])(
    'requires If-Match (428 REVISION_REQUIRED) for %p',
    (header) => {
      let caught: unknown;
      try {
        parseIfMatch(header);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(HttpException);
      const http = caught as HttpException;
      expect(http.getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);
      expect(http.getResponse()).toMatchObject({ code: 'REVISION_REQUIRED' });
    },
  );

  it.each(['*', '"abc"', '"0"', '"1", "2"', '-1'])(
    'rejects malformed %p with 400',
    (header) => {
      expect(() => parseIfMatch(header)).toThrow(BadRequestException);
    },
  );

  it('412 STALE_REVISION when versions differ', () => {
    expect(() => assertRevision(2, 2)).not.toThrow();
    expect(() => assertRevision(3, 2)).toThrow(PreconditionFailedException);
  });
});

describe('ETagInterceptor', () => {
  async function run(body: unknown): Promise<string | undefined> {
    let etag: string | undefined;
    const response = {
      setHeader: (_name: string, value: string) => {
        etag = value;
      },
    };
    const context = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;
    await lastValueFrom(
      new ETagInterceptor().intercept(context, { handle: () => of(body) }),
    );
    return etag;
  }

  it('sets ETag from rowVersion', async () => {
    expect(await run({ id: 'a', rowVersion: 4 })).toBe('"4"');
  });

  it('leaves bodies without a numeric rowVersion alone', async () => {
    expect(await run({ items: [] })).toBeUndefined();
    expect(await run({ rowVersion: '4' })).toBeUndefined();
    expect(await run(null)).toBeUndefined();
  });
});
