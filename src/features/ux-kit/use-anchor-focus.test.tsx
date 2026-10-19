import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { anchorIdOf, useAnchorFocus } from './use-anchor-focus';
import { shouldSeek, useSeekAnchor, type AnchorListState } from './use-seek-anchor';

const at = (entry: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  };

/** The table's pattern: anchor → list (with focus) → seek when the row is missing. */
function useList(list: (focus: string | undefined) => AnchorListState) {
  const anchor = useAnchorFocus('rate-');
  useSeekAnchor(anchor, list(anchor.focus));
  return anchor;
}

describe('useAnchorFocus / useSeekAnchor (deep links to a row on a later keyset page)', () => {
  it('reads the row id of the hash for its prefix only', () => {
    expect(anchorIdOf('#rate-r7', 'rate-')).toBe('r7');
    expect(anchorIdOf('#valuation-rate-r7', 'rate-')).toBeNull();
    expect(anchorIdOf('#rate-', 'rate-')).toBeNull();
    expect(anchorIdOf('', 'rate-')).toBeNull();
  });

  it('seeks only when the settled list lacks the row and has more pages', () => {
    const anchor = { anchorId: 'r7', focus: undefined };
    expect(shouldSeek(anchor, { ids: ['r1'], hasMore: true, settled: true })).toBe(true);
    expect(shouldSeek(anchor, { ids: ['r1', 'r7'], hasMore: true, settled: true })).toBe(false);
    expect(shouldSeek(anchor, { ids: ['r1'], hasMore: false, settled: true })).toBe(false);
    expect(shouldSeek(anchor, { ids: [], hasMore: true, settled: false })).toBe(false);
    expect(shouldSeek({ anchorId: 'r7', focus: 'r7' }, { ids: [], hasMore: true, settled: true })).toBe(false);
    expect(shouldSeek({ anchorId: null, focus: undefined }, { ids: [], hasMore: true, settled: true })).toBe(false);
  });

  it('passes focus to the list once the row is on a later page; "show from the start" drops it for good', () => {
    const lists: Array<string | undefined> = [];
    const { result } = renderHook(
      () =>
        useList((focus) => {
          lists.push(focus);
          return focus ? { ids: ['r7', 'r8'], hasMore: false, settled: true } : { ids: ['r1', 'r2'], hasMore: true, settled: true };
        }),
      { wrapper: at('/planning/profiles/p1#rate-r7') },
    );
    expect(lists[0]).toBeUndefined();
    expect(result.current.focus).toBe('r7');
    act(() => result.current.showFromStart());
    expect(result.current.focus).toBeUndefined();
    expect(lists.at(-1)).toBeUndefined();
  });

  it('never seeks for a row already loaded or a page without a link', () => {
    const loaded = renderHook(() => useList(() => ({ ids: ['r7'], hasMore: true, settled: true })), { wrapper: at('/p#rate-r7') });
    expect(loaded.result.current.focus).toBeUndefined();
    const plain = renderHook(() => useList(() => ({ ids: [], hasMore: true, settled: true })), { wrapper: at('/p') });
    expect(plain.result.current).toMatchObject({ anchorId: null, focus: undefined });
  });
});
