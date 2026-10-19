import type { ReactNode } from 'react';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { MasterDataGate } from './master-data-gate';
import { MasterDataNav } from './master-data-nav';

export interface MasterDataLayoutProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** detail pages: link back to their list (and no section links) */
  back?: { to: string; label: string };
  /** admit the roles that write this page's records besides the master-data administrators */
  alsoAllowed?: boolean;
  children: ReactNode;
}

/** Frame of every master-data page: access gate, one page header, the section links on list pages. */
export function MasterDataLayout({ title, description, actions, back, alsoAllowed, children }: MasterDataLayoutProps) {
  return (
    <MasterDataGate title={title} alsoAllowed={alsoAllowed}>
      <Page>
        <PageHeader
          title={title}
          description={description}
          back={back}
          actions={
            <>
              <ReadOnlyHint />
              {actions}
            </>
          }
        />
        {!back && <MasterDataNav />}
        {children}
      </Page>
    </MasterDataGate>
  );
}
