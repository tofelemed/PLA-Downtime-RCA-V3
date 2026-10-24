import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PageGate } from '../shared/page-gate';
import { PlantsSection } from './plants-section';
import { PLANTS_PAGE } from './plants-page-path';
import { SitesSection } from './sites-section';

/**
 * `/setup/plants`: organizations, plants and the sites of the selected plant (moved from the Admin panel,
 * owner decision 22 Oct 2026). The plant's administrators read it and manage its sites; SuperAdmin and
 * OrgAdmin also create and edit plants.
 */
export function PlantsPage() {
  const { canAdministerTenant } = useCapabilities();
  const title = pageNameOf(PLANTS_PAGE);
  return (
    <PageGate title={title} allowed={canAdministerTenant} deniedText="Only the plant’s administrators can open organizations and plants.">
      <Page width="wide">
        <PageHeader title={title} />
        <PlantsSection />
        <SitesSection />
      </Page>
    </PageGate>
  );
}
