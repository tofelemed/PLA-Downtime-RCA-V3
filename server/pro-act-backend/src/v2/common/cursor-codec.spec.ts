import { BadRequestException } from '@nestjs/common';
import { CursorCodec } from './cursor-codec';

describe('CursorCodec', () => {
  it('round-trips sort value and id', () => {
    const payload = {
      sortValue: '2026-10-07T06:00:00.000Z',
      id: '9c3f6f2e-6a3d-4a56-9a2a-7d0e2f3c4b5a',
    };

    const cursor = CursorCodec.encode(payload);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(CursorCodec.decode(cursor)).toEqual(payload);
  });

  it('supports numeric and null sort values', () => {
    expect(
      CursorCodec.decode(CursorCodec.encode({ sortValue: 42, id: 'a' })),
    ).toEqual({ sortValue: 42, id: 'a' });
    expect(
      CursorCodec.decode(CursorCodec.encode({ sortValue: null, id: 'a' })),
    ).toEqual({ sortValue: null, id: 'a' });
  });

  it.each([
    ['garbage', 'not-a-cursor!!'],
    ['valid base64 but not json', Buffer.from('hello').toString('base64url')],
    [
      'json without id',
      Buffer.from(JSON.stringify({ s: 'x' })).toString('base64url'),
    ],
    [
      'json with wrong types',
      Buffer.from(JSON.stringify({ s: {}, i: 5 })).toString('base64url'),
    ],
    ['empty', ''],
  ])('rejects %s with 400 INVALID_CURSOR', (_label, cursor) => {
    expect(() => CursorCodec.decode(cursor)).toThrow(BadRequestException);
    try {
      CursorCodec.decode(cursor);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'INVALID_CURSOR',
      });
    }
  });
});
