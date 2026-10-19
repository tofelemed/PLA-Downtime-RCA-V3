import type { BrandingView as BrandingSettings } from '@/api/v2/types/administration';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { PlantSelector } from '@/features/plant-selector/plant-selector';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { APP_TITLE } from '@/features/ux-kit/page-layout/use-document-title';
import { UiIcon } from '@/lib/icons';
import { LiveIndicator } from './live-indicator';
import { UserBadge } from './user-badge';

const DEFAULT_NAME = APP_TITLE;

function BrandMark({ branding }: { branding: BrandingSettings | undefined }) {
  const initials = branding?.logoInitials || 'TF';
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-bold text-white"
      style={{ background: branding?.primaryColor || 'hsl(var(--primary))' }}
      aria-hidden
    >
      {branding?.logoUrl ? <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" /> : initials}
    </span>
  );
}

/**
 * The one-row app header (h-14, sticky): brand, plant scope, display currency, live-update state and
 * in-app notifications (SLA escalations) and the user. No dead controls: search and settings return only when they work.
 * The app name is not a heading — every page owns its single `<h1>` (PageHeader).
 */
export interface AppHeaderProps {
  branding: BrandingSettings | undefined;
  /** below 1024 px: the button that opens the navigation drawer (UX audit H-1) */
  navigation?: { open: boolean; onOpen: () => void };
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

export function AppHeader({ branding, navigation }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-header flex h-14 items-center gap-2 border-b bg-background px-3 sm:gap-4 sm:px-4">
      {navigation && <MenuButton open={navigation.open} onOpen={navigation.onOpen} />}
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark branding={branding} />
        <div className="hidden min-w-0 leading-tight lg:block">
          <div className="truncate text-sm font-semibold">{branding?.appName || DEFAULT_NAME}</div>
          {branding?.appSubtitle && <div className="hidden truncate text-xs text-muted-foreground xl:block">{branding.appSubtitle}</div>}
        </div>
      </div>
      <div className="min-w-0 border-l pl-3">
        <PlantSelector />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <LiveIndicator className="hidden md:flex" />
        <DisplayCurrencyToggle />
        <NotificationBell />
        <UserBadge />
      </div>
    </header>
  );
}
