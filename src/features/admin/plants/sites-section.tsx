import { useState } from 'react';
import { useSiteList } from '@/api/v2/queries/sites';
import type { SiteV2View } from '@/api/v2/types/sites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { NumberText } from '@/features/ux-kit/number-text';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { SiteDialog } from './site-dialog';

/** Which dialog is open: none, add, or rename one site. */
type Editing = null | 'new' | SiteV2View;

function siteColumns(onRename: ((site: SiteV2View) => void) | null): ReadonlyArray<DataTableColumn<SiteV2View>> {
  const columns: DataTableColumn<SiteV2View>[] = [
    { id: 'name', header: 'Site', cell: (site) => <>{site.name}{site.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}</> },
    { id: 'zone', header: 'Time zone', cell: (site) => site.timezone, nowrap: true },
    { id: 'day', header: 'Day starts', cell: (site) => site.operationalDayStart.slice(0, 5), nowrap: true },
    { id: 'units', header: 'Units', cell: (site) => <NumberText value={site.unitCount} />, align: 'right' },
  ];
  if (!onRename) return columns;
  return [
    ...columns,
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerLabel: 'Actions',
      cell: (site) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onRename(site)} aria-label={`Rename site ${site.name}`}>
            <ActionIcon.edit aria-hidden="true" />
            Rename
          </Button>
        </div>
      ),
    },
  ];
}

/**
 * Sites of the selected plant (Setup UX Phase 1): the default site carries the plant's units unless a unit names
 * another site. Plant administrators add and rename sites; the server refuses anyone else.
 */
export function SitesSection() {
  const { canAdministerTenant } = useCapabilities();
  const { selection } = usePlantSelection();
  const sites = useSiteList();
  const [editing, setEditing] = useState<Editing>(null);
  const plantName = selection?.tenant?.name ?? 'the selected plant';
  const canManage = canAdministerTenant;
  return (
    <Section
      title={`Sites of ${plantName}`}
      description="Units are placed on a site; a site can have its own time zone and production day start. Switch plant in the header to see another plant’s sites."
      actions={canManage && <Button variant="outline" onClick={() => setEditing('new')}><ActionIcon.add aria-hidden="true" />Add site</Button>}
    >
      <DataTable
        caption={`Sites of ${plantName}`}
        columns={siteColumns(canManage ? setEditing : null)}
        rows={sites.items}
        getRowKey={(site) => site.id}
        pager="none"
        status={{ isLoading: sites.isLoading, isError: sites.isError, error: sites.error, onRetry: () => void sites.refetch() }}
      />
      {editing && <SiteDialog site={editing === 'new' ? null : editing} plantName={plantName} onClose={() => setEditing(null)} />}
    </Section>
  );
}
