import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from './theme-provider';
import { applyStoredTheme, THEME_STORAGE_KEY } from './theme-storage';
import { ThemeToggle } from './theme-toggle';

function renderToggle() {
  return render(
    <AppThemeProvider>
      <ThemeToggle />
    </AppThemeProvider>,
  );
}

const html = () => document.documentElement;

describe('ThemeToggle', () => {
  beforeEach(() => {
    // next-themes listens to prefers-color-scheme even with enableSystem off; jsdom has no matchMedia
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }));
    window.localStorage.clear();
    html().classList.remove('dark', 'light');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    html().classList.remove('dark', 'light');
  });

  it('starts light and is named by the action it performs', async () => {
    renderToggle();
    expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    expect(html()).not.toHaveClass('dark');
  });

  it('switches to dark and back, toggling the dark class on <html>', async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
    await waitFor(() => expect(html()).toHaveClass('dark'));
    const back = screen.getByRole('button', { name: 'Switch to light theme' });
    await user.click(back);
    await waitFor(() => expect(html()).not.toHaveClass('dark'));
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('persists the choice under the namespaced key and restores it on the next visit', async () => {
    const user = userEvent.setup();
    const first = renderToggle();
    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
    await waitFor(() => expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
    first.unmount();
    html().classList.remove('dark');

    applyStoredTheme();
    expect(html()).toHaveClass('dark');
    renderToggle();
    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('pre-paint restore falls back to light for a missing or unknown value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    applyStoredTheme();
    expect(html()).not.toHaveClass('dark');
  });
});
