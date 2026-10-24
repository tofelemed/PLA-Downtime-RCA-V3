import type { BrandingView } from '@/api/v2/types/administration';
import { PlantSelector } from '@/features/plant-selector/plant-selector';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { UiIcon } from '@/lib/icons';
import { HeaderBrand } from './header-brand';
import { PlantTimezoneReadout } from './plant-timezone-readout';
import { ThemeToggle } from './theme-toggle';
import { UserBadge } from './user-badge';

/**
 * The one-row app header (h-14, sticky): brand, plant scope, plant timezone,
 * in-app notifications (SLA escalations) and the user. No dead controls: search and settings return only when they work.
 * The app name is not a heading — every page owns its single `<h1>` (PageHeader).
 */
export interface AppHeaderProps {
  /** below 1024 px: the button that opens the navigation drawer (UX audit H-1) */
  navigation?: { open: boolean; onOpen: () => void };
  branding?: BrandingView;
}

function MenuButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open navigation"
      aria-expanded={open}
      aria-controls="navigation-drawer"
      className="-ml-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <UiIcon.expandSidebar className="h-5 w-5" aria-hidden />
    </button>
  );
}

export function AppHeader({ navigation, branding }: AppHeaderProps) {
  return (
    // the branding's secondary colour accents the header (the built-in border colour while none is stored)
    <header
      className="sticky top-0 z-header flex h-14 items-center gap-2 border-b bg-background px-3 print:hidden sm:gap-4 sm:px-4"
      style={{ borderBottomColor: 'hsl(var(--brand-secondary, var(--border)))' }}
    >
      {navigation && <MenuButton open={navigation.open} onOpen={navigation.onOpen} />}
      <HeaderBrand branding={branding} />
      <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
      <div className="min-w-0">
        <PlantSelector />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <PlantTimezoneReadout />
        <ThemeToggle />
        <NotificationBell />
        <UserBadge />
      </div>
    </header>
  );
}
