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
      window.localStorage.setItem(key, JSON.stringify(draft));
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
  return (Object.keys(a) as Array<keyof EventFormValues>).filter((field) => a[field] !== b[field]);
}
