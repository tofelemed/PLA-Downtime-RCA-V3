import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_NAV_STATE, loadNavState, parseNavState, saveNavState, useNavState } from './use-nav-state';

describe('sidebar state per user', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts collapsed with every section open', () => {
    expect(loadNavState('u1')).toEqual(DEFAULT_NAV_STATE);
    expect(DEFAULT_NAV_STATE).toEqual({ collapsed: true, closedSections: [] });
  });

  it('unreadable stored values fall back to the defaults', () => {
    expect(parseNavState('not json')).toEqual(DEFAULT_NAV_STATE);
    expect(parseNavState('42')).toEqual(DEFAULT_NAV_STATE);
    expect(parseNavState('{"collapsed":false,"closedSections":["integration",3]}')).toEqual({
      collapsed: false,
      closedSections: ['integration'],
    });
  });

  it('persists per user and survives a remount', () => {
    const { result, unmount } = renderHook(() => useNavState('u1'));
    act(() => result.current.toggleCollapsed());
    act(() => result.current.toggleSection('administration'));
    expect(result.current.collapsed).toBe(false);
    expect(result.current.isSectionOpen('administration')).toBe(false);
    unmount();
    const again = renderHook(() => useNavState('u1'));
    expect(again.result.current.collapsed).toBe(false);
    expect(again.result.current.isSectionOpen('administration')).toBe(false);
    expect(renderHook(() => useNavState('u2')).result.current.collapsed).toBe(true);
  });

  it('focusSection opens the section and closes every other one, once per change of section', () => {
    const { result } = renderHook(() => useNavState('u1'));
    act(() => result.current.focusSection('pla'));
    expect(result.current.isSectionOpen('pla')).toBe(true);
    expect(result.current.isSectionOpen('downtime')).toBe(false);
    expect(result.current.isSectionOpen('overview')).toBe(false);
    // a manual close of the focused section sticks while the section stays the same
    act(() => result.current.toggleSection('pla'));
    act(() => result.current.focusSection('pla'));
    expect(result.current.isSectionOpen('pla')).toBe(false);
    act(() => result.current.focusSection('downtime'));
    expect(result.current.isSectionOpen('downtime')).toBe(true);
    expect(result.current.isSectionOpen('pla')).toBe(false);
  });

  it('storage failures never break the menu', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveNavState('u1', { collapsed: false, closedSections: [] })).not.toThrow();
    spy.mockRestore();
  });
});
