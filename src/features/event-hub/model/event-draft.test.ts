import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftKey, draftStore, isExpiredNewDraft, NEW_DRAFT_MAX_AGE_MS, newDraftStart, type EventDraft } from './event-draft';
import { EMPTY_FORM } from './event-form';

const draft: EventDraft = { baseRevision: 3, initial: EMPTY_FORM, values: { ...EMPTY_FORM, description: 'belt slipped' } };

describe('event draft storage (per user, plant and event; localStorage)', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keys drafts by user, plant and event (new events share one "new" slot per user and plant)', () => {
    expect(draftKey('user-1', 'plant-a', 'e1')).toBe('proact.eventHub.draft.user-1.plant-a.e1');
    expect(draftKey('user-1', 'plant-a', null)).toBe('proact.eventHub.draft.user-1.plant-a.new');
    expect(draftKey('user-2', 'plant-a', 'e1')).not.toBe(draftKey('user-1', 'plant-a', 'e1'));
    expect(draftKey('user-1', 'plant-b', 'e1')).not.toBe(draftKey('user-1', 'plant-a', 'e1'));
  });

  it('survives in localStorage (other tabs and reloads) until cleared', () => {
    const key = draftKey('user-1', 'plant-a', 'e1');
    draftStore.write(key, draft);
    expect(JSON.parse(window.localStorage.getItem(key) ?? 'null')).toMatchObject(draft);
    expect(draftStore.read(key)).toMatchObject({ ...draft, savedAt: expect.any(Number) });
    expect(draftStore.read(draftKey('user-2', 'plant-a', 'e1'))).toBeNull();
    draftStore.clear(key);
    expect(draftStore.read(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('E-9: a new-event draft expires after 12 h (or when its age is unknown)', () => {
    const now = Date.parse('2026-10-18T12:00:00.000Z');
    expect(isExpiredNewDraft({ ...draft, savedAt: now - NEW_DRAFT_MAX_AGE_MS }, now)).toBe(false);
    expect(isExpiredNewDraft({ ...draft, savedAt: now - NEW_DRAFT_MAX_AGE_MS - 1 }, now)).toBe(true);
    expect(isExpiredNewDraft(draft, now)).toBe(true);
    expect(newDraftStart({ ...draft, savedAt: now - 13 * 3_600_000 }, '', now)).toEqual({ kind: 'fresh' });
    expect(newDraftStart(null, 'u1', now)).toEqual({ kind: 'fresh' });
  });

  it('E-9: a draft of another unit than ?unitId= is offered, not imposed', () => {
    const now = Date.parse('2026-10-18T12:00:00.000Z');
    const recent: EventDraft = { ...draft, values: { ...draft.values, unitId: 'u1' }, savedAt: now - 60_000 };
    expect(newDraftStart(recent, 'u2', now)).toEqual({ kind: 'ask', draft: recent });
    expect(newDraftStart(recent, 'u1', now)).toEqual({ kind: 'restore', draft: recent });
    expect(newDraftStart(recent, '', now)).toEqual({ kind: 'restore', draft: recent });
    expect(newDraftStart({ ...recent, values: { ...recent.values, unitId: '' } }, 'u2', now).kind).toBe('restore');
  });

  it('ignores stored values that are not drafts', () => {
    const key = draftKey('user-1', 'plant-a', 'e1');
    window.localStorage.setItem(key, '{"values": 1}');
    expect(draftStore.read(key)).toBeNull();
    window.localStorage.setItem(key, 'not json');
    expect(draftStore.read(key)).toBeNull();
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const key = draftKey('user-1', 'plant-a', null);
    expect(() => draftStore.write(key, draft)).not.toThrow();
    expect(draftStore.read(key)).toBeNull();
    expect(() => draftStore.clear(key)).not.toThrow();
  });
});
