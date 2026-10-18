import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';

/** A section can retain its standalone entry point while sharing a workspace header. */
export function SectionPage({ embedded, title, description, actions, children }: {
  embedded?: boolean; title: string; description?: string; actions?: ReactNode; children: ReactNode;
}) {
  if (embedded) return <section className="space-y-4" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
      {actions}
    </div>
    {children}
  </section>;
  return <Page width="wide"><PageHeader title={title} description={description} actions={actions} />{children}</Page>;
}
