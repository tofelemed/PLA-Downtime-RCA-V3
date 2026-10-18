import type { ReactNode } from 'react';
import type { CapabilityKey } from '@/features/auth/capabilities';

/**
 * One protected route of an area module (`src/app/routes/<area>.tsx`). Each area owns its file, so a
 * feature track adds sub-page routes (e.g. `/events/:eventId`) without touching `App.tsx`.
 */
export interface AppRoute {
  /** react-router path, e.g. `/events` or `/events/:eventId` */
  path: string;
  element: ReactNode;
  /** downloads the page chunk ahead of navigation (menu hover / focus) */
  preload?: () => Promise<unknown>;
  /**
   * capability of the selected plant the page needs (UX audit B-7); without it the route shows one
   * denied page. Left out, it is the capability of the menu item the path belongs to
   * (`withMenuGates`), so a typed URL behaves like the menu. The server stays authoritative.
   */
  requires?: CapabilityKey;
  /** heading of the denied page; defaults to the menu item's name */
  gateTitle?: string;
}
