import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { MasterDataGate } from './master-data-gate';
import { MasterDataNav } from './master-data-nav';

export interface MasterDataLayoutProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** opt-in: a small status on the title's line (e.g. a record's Active / Retired badge) */
  titleAside?: ReactNode;
  /** detail pages: link back to their list (the section links stay, the list highlighted) */
  back?: { to: string; label: string };
  /** admit the roles that write this page's records besides the master-data administrators */
  alsoAllowed?: boolean;
  children: ReactNode;
}

/** Frame of every master-data page: access gate, one page header, the section links (list and sub-pages alike). */
export function MasterDataLayout({ title, description, actions, titleAside, back, alsoAllowed, children }: MasterDataLayoutProps) {
  return (
    <MasterDataGate title={title} alsoAllowed={alsoAllowed}>
      <Page>
        <PageHeader
          title={title}
          description={description}
          titleAside={titleAside}
          back={back}
          actions={
            <>
              <ReadOnlyHint />
              {actions}
            </>
          }
        />
        <MasterDataNav />
        {children}
      </Page>
    </MasterDataGate>
  );
}
