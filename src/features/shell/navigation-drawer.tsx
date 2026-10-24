import { useRef } from 'react';
import type { BrandingView as BrandingSettings } from '@/api/v2/types/administration';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { NavStateApi } from '@/features/auth/use-nav-state';
import { AppSidebar } from './app-sidebar';

export interface NavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: NavStateApi;
  branding: BrandingSettings | undefined;
}

/**
 * The menu below 1024 px (UX audit H-1): a left `Sheet` (focus trapped, Esc and the overlay close it)
 * holding the expanded sidebar; following a link closes it and leaves focus to the new page.
 */
export function NavigationDrawer({ open, onOpenChange, nav, branding }: NavigationDrawerProps) {
  // after following a link, focus goes to the new page's content (Layout), not back to the menu button
  const navigated = useRef(false);
  const onCloseAutoFocus = (event: Event) => {
    if (navigated.current) event.preventDefault();
    navigated.current = false;
  };
  const onNavigate = () => {
    navigated.current = true;
    onOpenChange(false);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="navigation-drawer"
        side="left"
        className="flex w-72 max-w-[85vw] flex-col gap-0 p-0"
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">Menu</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <AppSidebar nav={nav} branding={branding} variant="drawer" onNavigate={onNavigate} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
