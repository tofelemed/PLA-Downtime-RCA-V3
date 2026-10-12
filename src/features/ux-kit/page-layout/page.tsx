import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageWidth = 'default' | 'wide' | 'full';

export interface PageProps {
  children: ReactNode;
  /** `default` for forms and detail pages, `wide` for tables and dashboards, `full` for canvases */
  width?: PageWidth;
  className?: string;
}

const WIDTH: Record<PageWidth, string> = {
  default: 'max-w-6xl',
  wide: 'max-w-screen-2xl',
  full: 'max-w-none',
};

/**
 * Outer frame of a routed page: one consistent width and a 24 px rhythm between `PageHeader` and the
 * `Section`s below it.
 *
 * @example <Page width="wide"><PageHeader title="Units" actions={…} /><Section title="Active">…</Section></Page>
 */
export function Page({ children, width = 'default', className }: PageProps) {
  return <div className={cn('mx-auto w-full space-y-6', WIDTH[width], className)}>{children}</div>;
}
