import { createLogger } from '@/lib/logger';
import type { EventFormValues } from './event-form';

const log = createLogger('eventDraft');

/**
 * Unsaved form state of one event (UX04 "reconnect preserves unsaved form"): in memory while the form is
 * open and in `localStorage` (survives reloads and is shared by the user's tabs in this browser), keyed
 * by user, plant and event; cleared when the event is saved or the draft discarded. It holds only the
 * form's values (no tokens or other secrets). The revision the user started from is kept so a changed
 * server revision forces a conflict review.
 */
export interface EventDraft {
  /** row version the edit started from; null for a new event */
  baseRevision: number | null;
  /** values the form started from (the diff base of the PATCH) */
  initial: EventFormValues;
  values: EventFormValues;
  /** when the draft was last stored (ms since epoch); absent on drafts stored before E-9 */
  savedAt?: number;
}

/** E-9: a new-event draft older than this is dropped (an old stop is not resumed by surprise). */
export const NEW_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** True when a new-event draft is too old to resume (or of unknown age). */
export function isExpiredNewDraft(draft: EventDraft, now: number): boolean {
  return draft.savedAt === undefined || now - draft.savedAt > NEW_DRAFT_MAX_AGE_MS;
}

/** How a new-event form starts: fresh, with the stored draft, or by asking (the draft is of another unit). */
export type NewDraftStart = { kind: 'fresh' } | { kind: 'restore'; draft: EventDraft } | { kind: 'ask'; draft: EventDraft };

/**
 * E-9: an expired draft starts fresh; a draft for another unit than the one the page was opened for
 * (`?unitId=`) is offered, not imposed ("Resume draft or start new?"); otherwise it is restored.
 */
export function newDraftStart(stored: EventDraft | null, unitId: string, now: number): NewDraftStart {
  if (!stored || isExpiredNewDraft(stored, now)) return { kind: 'fresh' };
  const draftUnit = stored.values.unitId;
  if (unitId && draftUnit && draftUnit !== unitId) return { kind: 'ask', draft: stored };
  return { kind: 'restore', draft: stored };
}

export function draftKey(userId: string, tenantId: string, eventId: string | null): string {
  return `proact.eventHub.draft.${userId}.${tenantId}.${eventId ?? 'new'}`;
}

function isDraft(value: unknown): value is EventDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.values === 'object' && typeof draft.initial === 'object' && 'baseRevision' in draft;
}

/** Storage can be missing or blocked (private mode, previews): the form then keeps the draft in memory only. */
export const draftStore = {
  read(key: string): EventDraft | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isDraft(parsed) ? parsed : null;
    } catch (error) {
      log.warn('draft not readable', { key, error: String(error) });
      return null;
    }
  },
  write(key: string, draft: EventDraft): void {
    try {
      window.localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch (error) {
      log.warn('draft not stored', { key, error: String(error) });
    }
  },
  clear(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // nothing stored, nothing to clear
    }
  },
};

/** Fields whose value differs between two value sets (conflict view, "changed" markers). */
export function changedFields(a: EventFormValues, b: EventFormValues): Array<keyof EventFormValues> {
  return (Object.keys(a) as Array<keyof EventFormValues>).filter((field) => field !== 'intervalMode' && a[field] !== b[field]);
}
