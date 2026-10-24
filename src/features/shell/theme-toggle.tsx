import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { UiIcon } from '@/lib/icons';

/**
 * The header's sun / moon switch between the light and the dark theme. It shows the icon of the theme it
 * switches to and names that action ("Switch to dark theme"); the choice is stored by the ThemeProvider.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
  const Icon = dark ? UiIcon.lightTheme : UiIcon.darkTheme;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      data-testid="theme-toggle"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </Button>
  );
}
