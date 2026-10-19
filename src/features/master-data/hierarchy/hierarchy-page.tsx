import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { usePlantDirectory } from '@/features/plant-selector/use-plant-directory';
import { DataState } from '@/features/ux-kit/data-state';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { Section } from '@/features/ux-kit/page-layout';
import { EntityIcon } from '@/lib/icons';
import type { DirectoryOrganization as Organization, DirectoryPlant as Tenant } from '@/api/v2/types/plant-directory';
import { MasterDataLayout } from '../components/master-data-layout';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { HierarchyEditLink } from './hierarchy-edit-link';
import { HierarchyNode } from './hierarchy-node';
import { HierarchySearchResults } from './hierarchy-search';
import { PlantNode } from './plant-node';

function OrganizationNode({ organization, children }: { organization: Organization; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <HierarchyNode
      level={0}
      icon={EntityIcon.organization}
      kind="Organization"
      label={organization.name}
      expandable
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      actions={<HierarchyEditLink kind="organization" id={organization.id} name={organization.name} canEdit={organization.canEdit} />}
    >
      {children}
    </HierarchyNode>
  );
}

function Tree() {
  const directory = usePlantDirectory();
  const { selection, setSelection } = usePlantSelection();
  const canWrite = useMasterDataWriter();
  const actingId = selection?.tenant?.id;
  const switchTo = (organization: Organization, tenant: Tenant) => setSelection({ organization, tenant });
  if (directory.isLoading) return <DataState state="loading" />;
  if (directory.error) return <DataState state="error" error={directory.error} onRetry={directory.retry} />;
  return (
    <ul aria-label="Plant hierarchy" className="space-y-0.5">
      {directory.organizations.map((organization) => (
        <OrganizationNode key={organization.id} organization={organization}>
          {directory.tenants
            .filter((tenant) => tenant.organizationId === organization.id)
            .map((plant) => (
              <PlantNode
                key={plant.id}
                organization={organization}
                plant={plant}
                acting={plant.id === actingId}
                level={1}
                canWrite={canWrite}
                onSwitch={switchTo}
              />
            ))}
        </OrganizationNode>
      ))}
    </ul>
  );
}

/**
 * `/master-data/hierarchy`: organization → plants → units → assets. Units and assets load when their node
 * opens; a search lists matching units and assets of the selected plant instead of the tree.
 */
export function HierarchyPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { canUseAdminPanel } = useCapabilities();
  const setQ = (next: string) => setParams(next ? { q: next } : {}, { replace: true });
  return (
    <MasterDataLayout title="Plant hierarchy" description="Organization, plants, units and assets of the plants you can work in.">
      <Section
        title="Hierarchy"
        description={
          canUseAdminPanel ? (
            <>
              Organizations and plants are managed in the <Link className="underline" to="/admin">Admin panel</Link>.
            </>
          ) : undefined
        }
      >
        <DebouncedSearchInput value={q} onChange={setQ} label="Search units and assets" placeholder="Search units and assets..." className="max-w-sm" />
        {q.trim() ? <HierarchySearchResults q={q.trim()} /> : <Tree />}
      </Section>
    </MasterDataLayout>
  );
}
