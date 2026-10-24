import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { FormDialog } from '../components/form-dialog';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useUnitParam } from '../hooks/use-unit-param';
import { UnitStreamForm } from './unit-stream-form';

/** "Add stream" beside the page title, for the unit chosen in `?unitId=` (profile writers only). */
export function AddUnitStream() {
  const { canWriteProfiles } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId] = useUnitParam();
  const [adding, setAdding] = useState(false);
  if (!canWriteProfiles || !unitId) return null;
  return (
    <>
      <Button size="sm" className="whitespace-nowrap" onClick={() => setAdding(true)} data-testid="unit-stream-new">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add stream
      </Button>
      <FormDialog open={adding} onOpenChange={setAdding} title="Add stream" info="A draft stream of this unit; another manager approves it." testId="unit-stream-dialog">
        <UnitStreamForm unitId={unitId} timezone={refs.timezone} onDone={() => setAdding(false)} />
      </FormDialog>
    </>
  );
}
