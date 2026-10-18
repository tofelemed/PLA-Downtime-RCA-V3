import { EquipmentSetupProvider } from '@/features/equipment-setup/equipment-setup-provider';
import { SetupJourneyBar } from '@/features/equipment-setup/setup-journey-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isNavItemActive, NAVIGATION_ITEMS } from '@/features/auth/navigation-items';
import { useNavState } from '@/features/auth/use-nav-state';
import { AppHeader } from '@/features/shell/app-header';
import { AppSidebar } from '@/features/shell/app-sidebar';
import { useBranding } from '@/features/shell/use-branding';
import { PlantAccessGuard } from '@/features/v2-foundation/plant-access-guard';
import { APP_TITLE } from '@/features/ux-kit/page-layout/use-document-title';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

/** Route change: the tab title names the page (WCAG 2.4.2) and focus moves to the content (skip the menu). */
function useRouteAnnouncements(appName: string, mainRef: React.RefObject<HTMLElement>) {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    const item = NAVIGATION_ITEMS.find((entry) => isNavItemActive(entry, pathname));
    document.title = item ? `${item.name} · ${appName}` : appName;
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, appName, mainRef]);
}

/**
 * App shell: sticky one-row header, sticky sidebar (sections, rail) and the page as the document's
 * scroller (no inner scroll box, so full-page screenshots, print and browser find work). z-index scale
 * lives in tailwind.config.ts (`z-sidebar` < `z-header` < overlays).
 */
export const Layout = ({ children }: LayoutProps) => {
  const { session } = useAuth();
  const nav = useNavState(session?.user.id ?? null);
  const branding = useBranding(Boolean(session));
  const mainRef = useRef<HTMLElement>(null);
  useRouteAnnouncements(branding?.appName || APP_TITLE, mainRef);

  if (!session) return <div>{children}</div>;
  return (
    <div className="min-h-screen bg-muted/30">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-toast focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AppHeader branding={branding} />
      <div className="flex">
        <aside
          className={cn(
            'sticky top-14 z-sidebar h-[calc(100vh-3.5rem)] shrink-0 border-r bg-background transition-[width] duration-200',
            nav.collapsed ? 'w-16' : 'w-60',
          )}
        >
          <AppSidebar nav={nav} />
        </aside>
        <main ref={mainRef} id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-6">
          <PlantAccessGuard><EquipmentSetupProvider><SetupJourneyBar />{children}</EquipmentSetupProvider></PlantAccessGuard>
        </main>
      </div>
    </div>
  );
};
