import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock('./api/appSettingsApi', () => ({
  appSettingsApi: {
    getValue: vi.fn(async (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback)),
    setValue: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return { key, value };
    }),
  },
}));

const { tabVisibilityService, tabVisibilityKey, defaultTabVisibility } = await import('./TabVisibilityService');

describe('TabVisibilityService on app-settings (plan 3.1 step 7)', () => {
  beforeEach(() => store.clear());

  it('defaults to every tab, stores per tenant and user on the server, and resets', async () => {
    expect((await tabVisibilityService.getVisibilitySettings('u1', 't1')).visibleTabs).toEqual(defaultTabVisibility);
    await tabVisibilityService.toggleTab('u1', 't1', 'IOW', false);
    expect(store.has(tabVisibilityKey('u1', 't1'))).toBe(true);
    expect((await tabVisibilityService.getVisibilitySettings('u1', 't1')).visibleTabs.IOW).toBe(false);
    expect((await tabVisibilityService.getVisibilitySettings('u1', 't2')).visibleTabs.IOW).toBe(true);
    await tabVisibilityService.resetToDefaults('u1', 't1');
    expect((await tabVisibilityService.getVisibilitySettings('u1', 't1')).visibleTabs.IOW).toBe(true);
  });
});
