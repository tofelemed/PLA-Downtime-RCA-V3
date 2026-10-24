import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { DEFAULT_THEME, THEME_STORAGE_KEY } from './theme-storage';

/**
 * App-wide light / dark theme: the `dark` class on `<html>` switches the tokens in `src/index.css`. Light is
 * the default and the OS preference is not followed (the user picks with the header's ThemeToggle).
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      themes={['light', 'dark']}
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
