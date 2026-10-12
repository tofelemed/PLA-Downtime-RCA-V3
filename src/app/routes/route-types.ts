import type { ReactNode } from 'react';

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
}
