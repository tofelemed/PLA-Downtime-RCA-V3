import type { DraftState } from './draft-lines';

export interface RetainedPeriodDraft {
  draft: DraftState;
  rowVersion: number;
  baseRunId: string | null;
  returnPath?: string;
}

/** Session-memory only. Scope changes clear all entries; save/discard clears one revision. */
let owner: string | null = null;
const entries = new Map<string, RetainedPeriodDraft>();
export const MAX_RETAINED_PERIOD_DRAFTS = 20;

export const retainedPeriodDrafts = {
  setOwner(next: string | null) {
    if (owner === next) return;
    entries.clear();
    owner = next;
  },
  read(scope: string | null, key: string): RetainedPeriodDraft | null {
    return scope && scope === owner ? entries.get(key) ?? null : null;
  },
  write(scope: string | null, key: string, value: RetainedPeriodDraft) {
    if (!scope || scope !== owner) return;
    if (value.draft.dirty && (entries.has(key) || entries.size < MAX_RETAINED_PERIOD_DRAFTS)) entries.set(key, value);
    else entries.delete(key);
  },
  list(scope: string | null) { return scope && scope === owner ? [...entries].map(([key, value]) => ({ key, ...value })) : []; },
  atCapacity(scope: string | null, key: string) { return scope === owner && !entries.has(key) && entries.size >= MAX_RETAINED_PERIOD_DRAFTS; },
  clear(scope: string | null, key: string) {
    if (scope === owner) entries.delete(key);
  },
  hasPending() { return entries.size > 0; },
};
