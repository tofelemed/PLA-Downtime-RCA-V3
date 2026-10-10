import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFxTransition } from '@/api/v2/queries/valuation';
import type { VersionState } from '@/api/v2/types/profiles';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';

export interface FxVersionActionsProps {
  id: string;
  state: VersionState;
  timezone: string;
}

/**
 * Approve / retire one FX rate version (mirrors the 3.4 version actions): the server decides who may
 * (403 shown with its code) and whether it overlaps an approved version of the pair (409 VERSION_OVERLAP
 * with the conflicting versions inline); "supersede" closes the approved predecessor at this start.
 */
export function FxVersionActions({ id, state, timezone }: FxVersionActionsProps) {
  const transition = useFxTransition();
  const [supersede, setSupersede] = useState(false);
  const supersedeId = useId();
  if (state === 'retired') return <span className="text-xs text-muted-foreground">Retired — kept as history</span>;
  const run = (action: 'approve' | 'retire') => transition.submit({ id, action, supersede }).catch(() => undefined);
  return (
    <div className="space-y-2" data-testid="fx-actions">
      <div className="flex flex-wrap items-center gap-2">
        {state === 'draft' && (
          <>
            <Button size="sm" onClick={() => run('approve')} disabled={transition.isPending} data-testid="fx-approve">
              Approve
            </Button>
            <div className="flex items-center gap-1">
              <Checkbox id={supersedeId} checked={supersede} onCheckedChange={(checked) => setSupersede(checked === true)} data-testid="fx-supersede" />
              <Label htmlFor={supersedeId} className="text-xs">
                Supersede the approved predecessor
              </Label>
            </div>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => run('retire')} disabled={transition.isPending} data-testid="fx-retire">
          Retire
        </Button>
      </div>
      <RefusalNotice error={transition.error} timezone={timezone} />
    </div>
  );
}
