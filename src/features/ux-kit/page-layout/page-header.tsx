import type { ReactNode } from 'react';
import { HeaderTrail } from './header-trail';
import type { Crumb } from './route-trail';
import { useDocumentTitle } from './use-document-title';

export interface PageHeaderProps {
  /** the page's single `<h1>`; also the browser tab title */
  title: string;
  description?: ReactNode;
  /** primary actions, right-aligned (one primary button, the rest outline / icon buttons) */
  actions?: ReactNode;
  /** scope / plant / time-window slot under the title */
  meta?: ReactNode;
  /** link to the parent page, e.g. `{ to: '/planning', label: 'Planning' }` */
  back?: { to: string; label: string };
  /**
   * breadcrumb trail above the title (UX audit B-3). Left out, sub-pages get one from the route:
   * menu item › `back` › `title` (module pages get none). `false` keeps only the back link.
   */
  breadcrumbs?: readonly Crumb[] | false;
  /** default true: set `document.title` to `${title} · <app name>` (the only place tab titles are set) */
  documentTitle?: boolean;
}

/**
 * Title row of a page: breadcrumb trail (automatic on sub-pages) or back link, the single `<h1>`, a short description, a meta slot (scope,
 * plant, time window) and one actions area. Replaces stacked hero cards and per-page gradients.
 *
 * @example <PageHeader title="Production plans" description="Plans and versions per unit" actions={<Button>New plan</Button>} />
 */
export function PageHeader({ title, description, actions, meta, back, breadcrumbs, documentTitle = true }: PageHeaderProps) {
  useDocumentTitle(title, documentTitle);
  return (
    <header className="space-y-2">
      <HeaderTrail title={title} back={back} breadcrumbs={breadcrumbs} />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
    </header>
  );
}
