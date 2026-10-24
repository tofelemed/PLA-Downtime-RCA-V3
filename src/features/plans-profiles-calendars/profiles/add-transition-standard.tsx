import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { FormDialog } from '../components/form-dialog';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useUnitParam } from '../hooks/use-unit-param';
import { TransitionStandardForm } from './transition-standard-form';

/** "Add transition standard" beside the page title, for the unit chosen in `?unitId=` (profile writers only). */
export function AddTransitionStandard() {
  const { canWriteProfiles } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId] = useUnitParam();
  const [adding, setAdding] = useState(false);
  if (!canWriteProfiles || !unitId) return null;
  return (
    <>
      <Button size="sm" className="whitespace-nowrap" onClick={() => setAdding(true)} data-testid="transition-standard-new">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add transition standard
      </Button>
      <FormDialog open={adding} onOpenChange={setAdding} title="Add transition standard" info="A draft entry of the grade-transition matrix; another manager approves it." wide testId="transition-standard-dialog">
        <TransitionStandardForm unitId={unitId} productOptions={refs.productOptions} timezone={refs.timezone} onDone={() => setAdding(false)} />
      </FormDialog>
    </>
  );
}
