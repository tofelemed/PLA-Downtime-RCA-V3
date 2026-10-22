import type { OrganizationView, PlantView } from '@/api/v2/types/administration';
import type { DirectoryOrganization, DirectoryPlant } from '@/api/v2/types/plant-directory';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import type { CreatedPlant } from './use-hierarchy-create';

/** The directory entry of a plant view (what the header selection stores). */
function directoryPlantOf(plant: PlantView): DirectoryPlant {
  const { id, code, name, organizationId, timezone, calendarSystem, digits, weekStart, canEdit } = plant;
  return { id, code, name, organizationId, timezone, calendarSystem, digits, weekStart, canEdit };
}

function directoryOrganizationOf(organization: OrganizationView | undefined): DirectoryOrganization | undefined {
  if (!organization) return undefined;
  const { id, code, name, canEdit } = organization;
  return { id, code, name, canEdit };
}

export interface SwitchPlantDialogProps {
  created: CreatedPlant | null;
  /** either answer: the dialog closes and the page goes back to the plant list */
  onDone: () => void;
}

/**
 * After a plant is created: units, assets and products are created in the plant selected in the header, so
 * the user is offered to switch to the new plant at once (owner decision 22 Oct 2026).
 */
export function SwitchPlantDialog({ created, onDone }: SwitchPlantDialogProps) {
  const { selection, setSelection } = usePlantSelection();
  if (!created) return null;
  const { plant, organization } = created;
  const current = selection?.tenant?.name;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      title={`Plant ${plant.name} created. Switch to it now?`}
      description={`Units, assets and products are created in the plant selected in the header. Switching selects ${plant.name} for the whole app.`}
      confirmLabel={`Switch to ${plant.name}`}
      cancelLabel={current ? `Stay in ${current}` : 'Not now'}
      onConfirm={() => setSelection({ organization: directoryOrganizationOf(organization), tenant: directoryPlantOf(plant) })}
    />
  );
}
