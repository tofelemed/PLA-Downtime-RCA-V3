import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Server-side `focus` of a list whose deep-linked row was not on the pages loaded first. */
export interface AnchorFocus {
  /** the row id named by the URL hash `#<prefix><id>`, else null */
  anchorId: string | null;
  /** `focus` query parameter for the list: set only after the row was missing from the first pages */
  focus: string | undefined;
  /** asks the server for the page starting at the linked row (keyset seek) */
  seek: () => void;
  /** back to the list from its start (the link is not followed again) */
  showFromStart: () => void;
}

interface FocusState {
  anchor: string;
  seeking: boolean;
  dismissed: boolean;
}

/** The id of `#<prefix><id>`, or null for another hash. */
export function anchorIdOf(hash: string, prefix: string): string | null {
  const anchor = decodeURIComponent(hash.replace(/^#/, ''));
  return anchor.startsWith(prefix) && anchor.length > prefix.length ? anchor.slice(prefix.length) : null;
}

/**
 * Deep links to a row on a later keyset page (`…#rate-<id>`): the list loads from its start as usual; when
 * the linked row is not on the loaded pages and more exist, `useSeekAnchor` calls `seek` and the list hook
 * passes `focus` to the server, which returns the page starting at that row. `showFromStart` drops it.
 *
 * @example
 * const anchor = useAnchorFocus('rate-');
 * const rates = useProfileRates(profile.id, anchor.focus);
 * useSeekAnchor(anchor, { ids, hasMore: rates.hasNextPage, settled: !rates.isFetching });
 */
export function useAnchorFocus(prefix: string): AnchorFocus {
  const { hash } = useLocation();
  const anchorId = anchorIdOf(hash, prefix);
  const [state, setState] = useState<FocusState | null>(null);
  const current = anchorId && state?.anchor === anchorId ? state : null;
  const seek = useCallback(() => {
    if (anchorId) setState((previous) => (previous?.anchor === anchorId ? previous : { anchor: anchorId, seeking: true, dismissed: false }));
  }, [anchorId]);
  const showFromStart = useCallback(() => {
    if (anchorId) setState({ anchor: anchorId, seeking: false, dismissed: true });
  }, [anchorId]);
  const focus = current?.seeking && !current.dismissed ? (anchorId ?? undefined) : undefined;
  return { anchorId, focus, seek, showFromStart };
}
