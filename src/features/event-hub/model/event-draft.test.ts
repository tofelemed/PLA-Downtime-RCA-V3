import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftKey, draftStore, type EventDraft } from './event-draft';
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
    expect(JSON.parse(window.localStorage.getItem(key) ?? 'null')).toEqual(draft);
    expect(draftStore.read(key)).toEqual(draft);
    expect(draftStore.read(draftKey('user-2', 'plant-a', 'e1'))).toBeNull();
    draftStore.clear(key);
    expect(draftStore.read(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
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
