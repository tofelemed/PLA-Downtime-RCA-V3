import type { ChangeNotice } from '@/api/v2/queries/invalidation';

/** Coalescing window of realtime invalidations (docs/UI_UX_AUDIT.md §4: a burst of notices → one refetch). */
export const INVALIDATION_BATCH_MS = 500;

type ChangeWindow = ChangeNotice['window'];

/** Union of two change windows; an unknown (null) window stays unknown (= every window). */
export function mergeWindows(a: ChangeWindow, b: ChangeWindow): ChangeWindow {
  if (!a || !b) return null;
  const from = a.from < b.from ? a.from : b.from;
  const to = a.to === null || b.to === null ? null : a.to > b.to ? a.to : b.to;
  return { from, to };
}

/**
 * Notices of one batch merged per (tenant, entity type): one invalidation per affected resource family
 * instead of one per notice. The entity id is dropped when several entities of a type changed.
 */
export function mergeNotices(notices: readonly ChangeNotice[]): ChangeNotice[] {
  const merged = new Map<string, ChangeNotice>();
  for (const notice of notices) {
    const key = `${notice.tenantId}|${notice.entityType}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { ...notice, window: notice.window ?? null });
      continue;
    }
    merged.set(key, {
      ...previous,
      entityId: previous.entityId === notice.entityId ? previous.entityId : undefined,
      window: mergeWindows(previous.window ?? null, notice.window ?? null),
    });
  }
  return [...merged.values()];
}

export interface InvalidationBatcher {
  add(notice: ChangeNotice): void;
  /** applies the pending batch now (tests, tenant switch) */
  flush(): void;
  /** drops the pending batch and the timer */
  dispose(): void;
}

/** Collects notices for `delayMs` after the first one, then applies them merged (trailing debounce). */
export function createInvalidationBatcher(
  apply: (notices: ChangeNotice[]) => void,
  delayMs: number = INVALIDATION_BATCH_MS,
): InvalidationBatcher {
  let pending: ChangeNotice[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending.length === 0) return;
    const batch = mergeNotices(pending);
    pending = [];
    apply(batch);
  };
  return {
    add(notice) {
      pending.push(notice);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = [];
    },
  };
}
