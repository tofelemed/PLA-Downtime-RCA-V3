import { useState } from 'react';
import type { DirectoryPlant } from '@/api/v2/types/plant-directory';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { usePlantDirectory, type PlantDirectory } from '@/features/plant-selector/use-plant-directory';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';

export interface ActingPlantFieldProps {
  /** create forms: the plant can be switched here; edit forms show it read-only (a record never moves plant) */
  editable: boolean;
  /** after a confirmed switch: reset the fields that depend on the plant (e.g. an asset's unit) */
  onSwitched?: () => void;
}

const ID = 'acting-plant';
const HINT_ID = `${ID}-hint`;

/** "Organization › Plant" of the header selection. */
function usePlantLabel(): string {
  const { selection } = usePlantSelection();
  const plant = selection?.tenant?.name ?? 'No plant selected';
  return selection?.organization?.name ? `${selection.organization.name} › ${plant}` : plant;
}

function ReadOnlyPlant() {
  const label = usePlantLabel();
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Plant: </span>
      {label}
    </p>
  );
}

function PlantOptions({ directory }: { directory: PlantDirectory }) {
  return (
    <SelectContent>
      {directory.organizations.map((organization) => (
        <SelectGroup key={organization.id}>
          <SelectLabel>{organization.name}</SelectLabel>
          {directory.tenants.filter((plant) => plant.organizationId === organization.id).map((plant) => (
            <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </SelectContent>
  );
}

/**
 * The plant a new master-data record is created in: the plant selected in the header (the server takes it
 * from the request). Choosing another plant here switches the header selection after a confirmation, so the
 * form's lookups reload for that plant (owner decision 22 Oct 2026).
 */
export function ActingPlantField({ editable, onSwitched }: ActingPlantFieldProps) {
  const directory = usePlantDirectory();
  const { selection, setSelection } = usePlantSelection();
  // the target stays set while the dialog closes, so its text does not change during the animation
  const [target, setTarget] = useState<DirectoryPlant | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (!editable) return <ReadOnlyPlant />;
  const currentId = selection?.tenant?.id;
  const choose = (id: string) => {
    const plant = directory.tenants.find((entry) => entry.id === id);
    if (!plant || id === currentId) return;
    setTarget(plant);
    setConfirming(true);
  };
  const confirm = () => {
    if (!target) return;
    setSelection({ organization: directory.organizations.find((org) => org.id === target.organizationId), tenant: target });
    onSwitched?.();
  };
  const name = target?.name ?? '';
  return (
    <div className="space-y-1.5">
      <Label htmlFor={ID}>Plant</Label>
      <Select value={currentId} onValueChange={choose} disabled={directory.isLoading}>
        <SelectTrigger id={ID} aria-describedby={HINT_ID} className="sm:max-w-sm">
          <SelectValue placeholder={directory.isLoading ? 'Loading plants…' : 'Choose a plant'} />
        </SelectTrigger>
        <PlantOptions directory={directory} />
      </Select>
      <p id={HINT_ID} className="text-xs text-muted-foreground">The record is created in this plant, the one selected in the header.</p>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Switch the selected plant to ${name}?`}
        description={`The record will be created in ${name} and the whole app switches to ${name}.`}
        confirmLabel={`Switch to ${name}`}
        onConfirm={confirm}
      />
    </div>
  );
}
