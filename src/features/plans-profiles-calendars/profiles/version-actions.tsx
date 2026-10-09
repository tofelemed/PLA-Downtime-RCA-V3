import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useVersionTransition, type VersionResource } from '@/api/v2/queries/profile-commands';
import type { VersionState } from '@/api/v2/types/profiles';
import { RefusalNotice } from '../components/refusal-notice';

export interface VersionActionsProps {
  resource: VersionResource;
  id: string;
  state: VersionState;
  timezone: string;
  /** shown for drafts only (approved versions are immutable: add a new version instead) */
  onEdit?: () => void;
  testId?: string;
}

/**
 * Approve / retire of one version. The server decides who may (403 shown as is) and whether it overlaps
 * an approved version (409 VERSION_OVERLAP with the conflicting versions listed inline); "supersede"
 * asks the server to close the one approved predecessor at this version's start.
 */
export function VersionActions({ resource, id, state, timezone, onEdit, testId }: VersionActionsProps) {
  const transition = useVersionTransition();
  const [supersede, setSupersede] = useState(false);
  const supersedeId = useId();
  if (state === 'retired') return <span className="text-xs text-muted-foreground">Retired — kept as history</span>;
  const run = (action: 'approve' | 'retire') => transition.submit({ resource, id, action, supersede }).catch(() => undefined);
  return (
    <div className="space-y-2" data-testid={testId ?? 'version-actions'}>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'draft' && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit draft
          </Button>
        )}
        {state === 'draft' && (
          <>
            <Button size="sm" onClick={() => run('approve')} disabled={transition.isPending} data-testid="approve-version">
              Approve
            </Button>
            <div className="flex items-center gap-1">
              <Checkbox id={supersedeId} checked={supersede} onCheckedChange={(checked) => setSupersede(checked === true)} data-testid="supersede" />
              <Label htmlFor={supersedeId} className="text-xs">
                Supersede the approved predecessor
              </Label>
            </div>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => run('retire')} disabled={transition.isPending}>
          Retire
        </Button>
      </div>
      <RefusalNotice error={transition.error} timezone={timezone} />
    </div>
  );
}
