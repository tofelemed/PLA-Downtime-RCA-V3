import { Link } from 'react-router-dom';
import { useDeleteOrganization, useDeletePlant, useOrganizations, usePlantsPage } from '@/api/v2/queries/administration-config';
import type { OrganizationView, PlantView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { IconButton } from '@/features/ux-kit/icon-button';
import { CALENDAR_SYSTEM_LABELS, labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { weekStartLabel } from '@/features/settings/week-start-choices';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { PLANTS_PAGE } from './plants-page-path';

function DeleteButton({ name, kind, onConfirm }: { name: string; kind: 'organization' | 'plant'; onConfirm: () => Promise<unknown> }) {
  return (
    <ConfirmDialog
      trigger={<IconButton icon={ActionIcon.delete} label={`Delete ${kind} ${name}`} />}
      title={`Delete ${kind} ${name}?`}
      description={kind === 'plant' ? 'Only an empty plant (no units, no users) can be deleted. This cannot be undone.' : 'Only an organization without plants can be deleted. This cannot be undone.'}
      confirmLabel={`Delete ${kind}`}
      destructive
      onConfirm={onConfirm}
    />
  );
}

function EditLink({ kind, id, name }: { kind: 'organization' | 'plant'; id: string; name: string }) {
  const path = kind === 'plant' ? `${PLANTS_PAGE}/${encodeURIComponent(id)}/edit` : `${PLANTS_PAGE}/organizations/${encodeURIComponent(id)}/edit`;
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={path} aria-label={`Edit ${kind} ${name}`}>
        <ActionIcon.edit aria-hidden="true" />
        Edit
      </Link>
    </Button>
  );
}

function useOrganizationColumns(): ReadonlyArray<DataTableColumn<OrganizationView>> {
  const remove = useDeleteOrganization();
  const feedback = useCommandFeedback();
  return [
    { id: 'name', header: 'Organization', cell: (org) => org.name },
    { id: 'code', header: 'Code', cell: (org) => org.code, nowrap: true },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerLabel: 'Actions',
      cell: (org) => (
        <div className="flex justify-end gap-1">
          {org.canEdit && <EditLink kind="organization" id={org.id} name={org.name} />}
          {org.canAddPlants && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`${PLANTS_PAGE}/new?organizationId=${encodeURIComponent(org.id)}`}>Add plant</Link>
            </Button>
          )}
          {org.canDelete && <DeleteButton name={org.name} kind="organization" onConfirm={() => feedback(() => remove.submit(org.id), 'Organization deleted')} />}
        </div>
      ),
    },
  ];
}

function usePlantColumns(): ReadonlyArray<DataTableColumn<PlantView>> {
  const remove = useDeletePlant();
  const feedback = useCommandFeedback();
  return [
    { id: 'name', header: 'Plant', cell: (plant) => plant.name },
    { id: 'code', header: 'Code', cell: (plant) => plant.code, nowrap: true },
    { id: 'org', header: 'Organization', cell: (plant) => plant.organizationName ?? '—' },
    { id: 'zone', header: 'Time zone', cell: (plant) => plant.timezone ?? 'From its sites', nowrap: true },
    { id: 'calendar', header: 'Calendar', cell: (plant) => labelOf(CALENDAR_SYSTEM_LABELS, plant.calendarSystem), nowrap: true },
    { id: 'week', header: 'Week starts', cell: (plant) => weekStartLabel(plant.weekStart), nowrap: true },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerLabel: 'Actions',
      cell: (plant) => (
        <div className="flex justify-end gap-1">
          {plant.canEdit && <EditLink kind="plant" id={plant.id} name={plant.name} />}
          {plant.canDelete && <DeleteButton name={plant.name} kind="plant" onConfirm={() => feedback(() => remove.submit(plant.id), 'Plant deleted')} />}
        </div>
      ),
    },
  ];
}

/** Organizations and plants (was "Hierarchy management"); units and assets live in Master data. */
export function PlantsSection() {
  const { isSuperAdmin, canManagePlants } = useCapabilities();
  const organizations = useOrganizations();
  const plants = usePlantsPage();
  const orgColumns = useOrganizationColumns();
  const plantColumns = usePlantColumns();
  return (
    <>
      <Section
        title="Organizations"
        description="Companies that own plants."
        actions={isSuperAdmin && <Button asChild variant="outline"><Link to={`${PLANTS_PAGE}/organizations/new`}><ActionIcon.add aria-hidden="true" />Add organization</Link></Button>}
      >
        <DataTable
          caption="Organizations"
          columns={orgColumns}
          rows={organizations.data?.items ?? []}
          getRowKey={(org) => org.id}
          status={{ isLoading: organizations.isLoading, isError: organizations.isError, error: organizations.error, onRetry: () => void organizations.refetch() }}
        />
      </Section>
      <Section
        title="Plants"
        description={<>Plants you administer. Units, assets and products are managed in <Link className="underline" to="/master-data/units">Setup › Plant &amp; equipment</Link>; people in <Link className="underline" to="/users">Users</Link>.</>}
        actions={canManagePlants && <Button asChild variant="outline"><Link to={`${PLANTS_PAGE}/new`}><ActionIcon.add aria-hidden="true" />Add plant</Link></Button>}
      >
        <DataTable caption="Plants" columns={plantColumns} rows={plants.rows} getRowKey={(plant) => plant.id} pager={plants.pager} status={plants.status} />
      </Section>
    </>
  );
}
