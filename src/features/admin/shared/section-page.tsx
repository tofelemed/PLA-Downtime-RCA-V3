import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';

/**
 * A section that is a tab of a workspace (embedded: its cards only; the tab names it) or a page of its own
 * (title only, no description: the cards carry their ⓘ and actions).
 */
export function SectionPage({ embedded, title, children }: { embedded?: boolean; title: string; children: ReactNode }) {
  if (embedded) return <div className="space-y-4">{children}</div>;
  return (
    <Page width="wide">
      <PageHeader title={title} />
      {children}
    </Page>
  );
}
