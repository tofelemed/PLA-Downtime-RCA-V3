import { BadRequestException } from '@nestjs/common';

/** Keyset position: the sort column's value of the last row on the page plus its id as tiebreak. */
export interface CursorPayload {
  sortValue: string | number | null;
  id: string;
}

interface WireCursor {
  s: string | number | null;
  i: string;
}

export function invalidCursor(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_CURSOR',
    message: 'cursor was not issued by this API',
  });
}

/** Opaque, URL-safe cursor. Clients must treat it as a token; its layout may change without notice. */
export const CursorCodec = {
  encode(payload: CursorPayload): string {
    const wire: WireCursor = { s: payload.sortValue, i: payload.id };
    return Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');
  },

  decode(cursor: string): CursorPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      throw invalidCursor();
    }
    if (!isWireCursor(parsed)) {
      throw invalidCursor();
    }
    return { sortValue: parsed.s, id: parsed.i };
  },
};

function isWireCursor(value: unknown): value is WireCursor {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { s, i } = value as Record<string, unknown>;
  const sortValueOk =
    s === null ||
    typeof s === 'string' ||
    (typeof s === 'number' && Number.isFinite(s));
  return (
    sortValueOk && typeof i === 'string' && i.length > 0 && i.length <= 128
  );
}
