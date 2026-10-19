import { useEffect, useRef } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { anchorPageOf } from './anchor-page';
import type { PagerModel } from './pager-model';

interface SyncProps<T> {
  /** every row of the table (not only the current page) */
  rows: readonly T[];
  getRowAnchor: (row: T) => string | undefined;
  pager: PagerModel;
}

export interface AnchorPageSyncProps<T> {
  rows: readonly T[];
  getRowAnchor?: (row: T) => string | undefined;
  /** the client pager (null for server-paged or unpaged tables: nothing to turn) */
  pager: PagerModel | null;
}

function AnchorPageSyncInRouter<T>({ rows, getRowAnchor, pager }: SyncProps<T>) {
  const { hash } = useLocation();
  const anchor = decodeURIComponent(hash.replace(/^#/, ''));
  const applied = useRef('');
  const page = anchorPageOf(rows, getRowAnchor, anchor, pager.pageSize);
  const { goTo, pageIndex } = pager;
  useEffect(() => {
    if (page < 0 || applied.current === anchor) return;
    applied.current = anchor;
    if (page !== pageIndex) goTo?.(page);
  }, [anchor, page, pageIndex, goTo]);
  return null;
}

/**
 * Deep links into a client-paged table (`…#rate-<id>`): once the linked row is among the rows, the table
 * turns to the page that holds it (once per link, so paging afterwards stays the user's); the app shell's
 * `useHighlightTarget` then scrolls to it and highlights it. Outside a router (isolated tests) it does nothing.
 */
export function AnchorPageSync<T>({ rows, getRowAnchor, pager }: AnchorPageSyncProps<T>) {
  const inRouter = useInRouterContext();
  if (!inRouter || !getRowAnchor || !pager) return null;
  return <AnchorPageSyncInRouter rows={rows} getRowAnchor={getRowAnchor} pager={pager} />;
}
