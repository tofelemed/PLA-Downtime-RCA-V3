import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UiIcon } from '@/lib/icons';
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
  /** default true: set `document.title` to `${title} · Traverse Forge` */
  documentTitle?: boolean;
}

/**
 * Title row of a page: optional back link, the single `<h1>`, a short description, a meta slot (scope,
 * plant, time window) and one actions area. Replaces stacked hero cards and per-page gradients.
 *
 * @example <PageHeader title="Production plans" description="Plans and versions per unit" actions={<Button>New plan</Button>} />
 */
export function PageHeader({ title, description, actions, meta, back, documentTitle = true }: PageHeaderProps) {
  useDocumentTitle(title, documentTitle);
  return (
    <header className="space-y-2">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
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
