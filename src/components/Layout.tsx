import { EquipmentSetupProvider } from '@/features/equipment-setup/equipment-setup-provider';
import { SetupJourneyBar } from '@/features/equipment-setup/setup-journey-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavState } from '@/features/auth/use-nav-state';
import { AppHeader } from '@/features/shell/app-header';
import { AppSidebar } from '@/features/shell/app-sidebar';
import { NavigationDrawer } from '@/features/shell/navigation-drawer';
import { useBranding } from '@/features/shell/use-branding';
import { useResponsiveNav, useShellMode } from '@/features/shell/use-shell-mode';
import { PlantAccessGuard } from '@/features/v2-foundation/plant-access-guard';
import { RouteErrorBoundary } from '@/features/ux-kit/errors/route-error-boundary';
import { HighlightTarget } from '@/features/ux-kit/highlight-target';
import { useSyncAppName } from '@/features/ux-kit/page-layout/app-name';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Route change: focus moves to the content (skip the menu). The tab title is set by the page itself
 * (`PageHeader` / `useDocumentTitle`), with the branding's app name, never here.
 */
function useRouteFocus(pathname: string, mainRef: React.RefObject<HTMLElement>) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef]);
}

/** Drawer open state: closed on every route change and whenever the screen grows past the drawer width. */
function useDrawer(pathname: string, drawerMode: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname, drawerMode]);
  return { open: drawerMode && open, setOpen };
}

/**
 * App shell: sticky one-row header, sticky sidebar (sections, rail) and the page as the document's
 * scroller (no inner scroll box, so full-page screenshots, print and browser find work). A page that
 * crashes shows its error inside the shell (route-level boundary, reset on navigation). z-index scale
 * lives in tailwind.config.ts (`z-sidebar` < `z-header` < overlays). Below 1024 px the menu is a drawer
 * opened from the header, 1024–1279 px an icon rail by default (UX audit H-1).
 */
export const Layout = ({ children }: LayoutProps) => {
  const { session, expireSession } = useAuth();
  const { pathname } = useLocation();
  const savedNav = useNavState(session?.user.id ?? null);
  const mode = useShellMode();
  const nav = useResponsiveNav(savedNav, mode);
  const drawer = useDrawer(pathname, mode === 'drawer');
  const branding = useBranding(Boolean(session));
  const mainRef = useRef<HTMLElement>(null);
  useSyncAppName(branding?.appName);
  useRouteFocus(pathname, mainRef);

  if (!session) return <div>{children}</div>;
  return (
    <div className="min-h-screen bg-muted/30">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-toast focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AppHeader branding={branding} navigation={mode === 'drawer' ? { open: drawer.open, onOpen: () => drawer.setOpen(true) } : undefined} />
      {mode === 'drawer' && <NavigationDrawer open={drawer.open} onOpenChange={drawer.setOpen} nav={nav} />}
      <div className="flex">
        {mode !== 'drawer' && (
          <aside
            className={cn(
              'sticky top-14 z-sidebar h-[calc(100vh-3.5rem)] shrink-0 border-r bg-background transition-[width] duration-200 print:hidden',
              nav.collapsed ? 'w-16' : 'w-60',
            )}
          >
            <AppSidebar nav={nav} />
          </aside>
        )}
        <main ref={mainRef} id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">
          <RouteErrorBoundary resetKey={pathname} onAuthFailure={expireSession}>
            <PlantAccessGuard><EquipmentSetupProvider><SetupJourneyBar />{children}</EquipmentSetupProvider></PlantAccessGuard>
          </RouteErrorBoundary>
          <HighlightTarget />
        </main>
      </div>
    </div>
  );
};
