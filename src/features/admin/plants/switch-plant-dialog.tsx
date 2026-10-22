import { useNavigate } from 'react-router-dom';
import type { OrganizationView, PlantView } from '@/api/v2/types/administration';
import type { DirectoryOrganization, DirectoryPlant } from '@/api/v2/types/plant-directory';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { pageNameOf } from '@/features/auth/navigation-items';
import { SaveResultDialog, type SaveResult } from '@/features/ux-kit/save-result';
import { PLANTS_PAGE } from './plants-page-path';
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
  /** the dialog closed (any answer) */
  onClose: () => void;
  /** "Add another": empties the form */
  onAddAnother: () => void;
}

interface PlantResultInput {
  created: CreatedPlant;
  current: string | undefined;
  switchToIt: () => void;
  onAddAnother: () => void;
  onDismiss: () => void;
}

function plantResult({ created, current, switchToIt, onAddAnother, onDismiss }: PlantResultInput): SaveResult {
  const { plant } = created;
  const stay = current ? ` Until you switch, you stay in ${current}.` : '';
  return {
    title: 'Plant created',
    recordLabel: `${plant.name} (${plant.code})`,
    message: `Units, assets and products are created in the plant selected in the header.${stay}`,
    viewPath: `${PLANTS_PAGE}/${plant.id}/edit`,
    viewLabel: 'View plant',
    listPath: PLANTS_PAGE,
    listLabel: pageNameOf(PLANTS_PAGE),
    onAddAnother,
    primaryAction: { label: `Switch to ${plant.name}`, onSelect: switchToIt },
    onDismiss,
  };
}

/**
 * After a plant is created: the result dialog with "Switch to <plant>" as its primary action, since units,
 * assets and products are created in the plant selected in the header (owner decision 22 Oct 2026).
 * Switching selects the plant and goes back to the plant list; dismissing opens the new plant's page.
 */
export function SwitchPlantDialog({ created, onClose, onAddAnother }: SwitchPlantDialogProps) {
  const { selection, setSelection } = usePlantSelection();
  const navigate = useNavigate();
  const result = created && plantResult({
    created,
    current: selection?.tenant?.name,
    switchToIt: () => {
      setSelection({ organization: directoryOrganizationOf(created.organization), tenant: directoryPlantOf(created.plant) });
      navigate(PLANTS_PAGE);
    },
    onAddAnother,
    onDismiss: () => navigate(`${PLANTS_PAGE}/${created.plant.id}/edit`, { replace: true }),
  });
  return <SaveResultDialog result={result} onClose={onClose} />;
}
