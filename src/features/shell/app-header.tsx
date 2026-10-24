import type { BrandingView } from '@/api/v2/types/administration';
import { PlantSelector } from '@/features/plant-selector/plant-selector';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { HeaderApprovals } from './header-approvals';
import { HeaderBrand } from './header-brand';
import { PlantTimezoneReadout } from './plant-timezone-readout';
import { CONTENT_INSET_CLASS, sidebarWidthClass } from './sidebar-width';
import { ThemeToggle } from './theme-toggle';
import { UserBadge } from './user-badge';

/**
 * The one-row app header (h-14, sticky): brand, plant scope, plant timezone,
 * pending approvals, in-app notifications (SLA escalations) and the user. No dead controls: search and settings return only when they work.
 * The app name is not a heading — every page owns its single `<h1>` (PageHeader).
 */
export interface AppHeaderProps {
  /** below 1024 px: the button that opens the navigation drawer (UX audit H-1) */
  navigation?: { open: boolean; onOpen: () => void };
  branding?: BrandingView;
  /** from 1024 px: the sidebar's state, so the brand cell matches its width and the hierarchy lines up with the page */
  rail?: { collapsed: boolean };
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

/** Brand cell exactly as wide as the sidebar (same edge line), then the hierarchy at the page content's inset. */
function RailStart({ branding, collapsed }: { branding: BrandingView | undefined; collapsed: boolean }) {
  return (
    <>
      <div
        className={cn(
          'flex h-full shrink-0 items-center border-r border-sidebar-border bg-sidebar transition-[width] duration-200',
          sidebarWidthClass(collapsed),
          collapsed ? 'justify-center' : 'px-3',
        )}
      >
        <HeaderBrand branding={branding} compact={collapsed} />
      </div>
      <div className={cn('min-w-0', CONTENT_INSET_CLASS)}>
        <PlantSelector />
      </div>
    </>
  );
}

/** Below 1024 px (no sidebar): menu button, brand, divider, hierarchy. */
function DrawerStart({ branding, navigation }: Pick<AppHeaderProps, 'branding' | 'navigation'>) {
  return (
    <>
      {navigation && <MenuButton open={navigation.open} onOpen={navigation.onOpen} />}
      <HeaderBrand branding={branding} />
      <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
      <div className="min-w-0">
        <PlantSelector />
      </div>
    </>
  );
}

export function AppHeader({ navigation, branding, rail }: AppHeaderProps) {
  return (
    // the branding's secondary colour accents the header (the built-in border colour while none is stored)
    <header
      className={cn(
        'sticky top-0 z-header flex h-14 items-center border-b bg-background print:hidden',
        rail ? 'pr-3 sm:pr-4' : 'gap-2 px-3 sm:gap-4 sm:px-4',
      )}
      style={{ borderBottomColor: 'hsl(var(--brand-secondary, var(--border)))' }}
    >
      {rail ? <RailStart branding={branding} collapsed={rail.collapsed} /> : <DrawerStart branding={branding} navigation={navigation} />}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <PlantTimezoneReadout />
        <ThemeToggle />
        <HeaderApprovals />
        <NotificationBell />
        <UserBadge />
      </div>
    </header>
  );
}
