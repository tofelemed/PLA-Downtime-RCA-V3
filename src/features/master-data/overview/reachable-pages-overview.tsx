import { Link } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { MasterDataLayout } from '../components/master-data-layout';
import { visibleMasterDataSections } from '../components/master-data-sections';

/**
 * `/master-data` for a user who is not a master-data administrator but writes one of its reliability
 * pages (e.g. a manager approver or a reliability engineer): the pages the user may open, nothing else.
 */
export function ReachablePagesOverview() {
  const capabilities = useCapabilities();
  const pages = visibleMasterDataSections(capabilities).filter((s) => !s.end);
  return (
    <MasterDataLayout title="Master data" description="The reliability plant data your role maintains." alsoAllowed={capabilities.canReachMasterData}>
      <Section title="Your pages">
        <ul className="space-y-1 text-sm" aria-label="Master data pages you can open">
          {pages.map((page) => (
            <li key={page.to}>
              <Link className="underline" to={page.to}>{page.label}</Link> — {page.text}
            </li>
          ))}
        </ul>
      </Section>
    </MasterDataLayout>
  );
}
