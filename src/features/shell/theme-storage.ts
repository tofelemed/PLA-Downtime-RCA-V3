/** The two app themes; light is the default (owner decision, dark-theme spec). */
export type AppTheme = 'light' | 'dark';

export const DEFAULT_THEME: AppTheme = 'light';

/** localStorage key of the user's theme choice (namespaced like the other `proact.*` preferences). */
export const THEME_STORAGE_KEY = 'proact.theme';

function storedTheme(): AppTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : DEFAULT_THEME;
  } catch {
    // storage blocked (private mode, policy): the default theme
    return DEFAULT_THEME;
  }
}

/**
 * Puts the stored theme's class on `<html>` before React renders, so a dark-theme user never sees a light
 * first paint (the ThemeProvider only applies it after mount). Called once from `main.tsx`.
 */
export function applyStoredTheme(): void {
  const dark = storedTheme() === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
