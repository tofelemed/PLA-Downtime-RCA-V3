import { CursorCodec, invalidCursor } from '../../v2/common/cursor-codec';

/** Keyset position of a portfolio page: the last row's cases, sort key and row key. */
export interface PortfolioPosition {
  cases: number;
  sortKey: string;
  rowKey: string;
}

export function encodePortfolioCursor(position: PortfolioPosition): string {
  return CursorCodec.encode({
    sortValue: JSON.stringify([position.cases, position.sortKey]),
    id: position.rowKey,
  });
}

/** The position after which the next page starts (null for the first page); 400 INVALID_CURSOR otherwise. */
export function decodePortfolioCursor(
  cursor: string | undefined,
): PortfolioPosition | null {
  if (!cursor) return null;
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'string') throw invalidCursor();
  let parsed: unknown;
  try {
    parsed = JSON.parse(sortValue);
  } catch {
    throw invalidCursor();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    !Number.isInteger(parsed[0]) ||
    typeof parsed[1] !== 'string'
  )
    throw invalidCursor();
  return { cases: parsed[0] as number, sortKey: parsed[1], rowKey: id };
}
