import type { BrandingView as BrandingSettings } from '@/api/v2/types/administration';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { PlantSelector } from '@/features/plant-selector/plant-selector';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { APP_TITLE } from '@/features/ux-kit/page-layout/use-document-title';
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
export function AppHeader({ branding }: { branding: BrandingSettings | undefined }) {
  return (
    <header className="sticky top-0 z-header flex h-14 items-center gap-4 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark branding={branding} />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-sm font-semibold">{branding?.appName || DEFAULT_NAME}</div>
          {branding?.appSubtitle && <div className="hidden truncate text-xs text-muted-foreground xl:block">{branding.appSubtitle}</div>}
        </div>
      </div>
      <div className="min-w-0 border-l pl-3">
        <PlantSelector />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <LiveIndicator className="hidden md:flex" />
        <DisplayCurrencyToggle />
        <NotificationBell />
        <UserBadge />
      </div>
    </header>
  );
}
