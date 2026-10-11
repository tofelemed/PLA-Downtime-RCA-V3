import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useVersionTransition, type VersionResource } from '@/api/v2/queries/profile-commands';
import type { VersionState } from '@/api/v2/types/profiles';
import { approvalAccess } from '@/features/auth/approval-gate';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { RefusalNotice } from '../components/refusal-notice';

export interface VersionActionsProps {
  resource: VersionResource;
  id: string;
  state: VersionState;
  timezone: string;
  /** shown for drafts only (approved versions are immutable: add a new version instead) */
  onEdit?: () => void;
  testId?: string;
  /** author of the version: the author cannot approve it (separation of duties) */
  authorId?: string | null;
}

/**
 * Approve / retire of one version. The server decides who may (403 shown as is) and whether it overlaps
 * an approved version (409 VERSION_OVERLAP with the conflicting versions listed inline); "supersede"
 * asks the server to close the one approved predecessor at this version's start. Controls the role can
 * never use are not shown (profile writers edit; manager approvers approve and retire).
 */
export function VersionActions({ resource, id, state, timezone, onEdit, testId, authorId }: VersionActionsProps) {
  const { canWriteProfiles, canApproveProfiles } = useCapabilities();
  const access = approvalAccess(canApproveProfiles, authorId, useCurrentUserId());
  const transition = useVersionTransition();
  const [supersede, setSupersede] = useState(false);
  const supersedeId = useId();
  if (state === 'retired') return <span className="text-xs text-muted-foreground">Retired — kept as history</span>;
  if (!canApproveProfiles && !(canWriteProfiles && state === 'draft' && onEdit)) return null;
  const run = (action: 'approve' | 'retire') => transition.submit({ resource, id, action, supersede }).catch(() => undefined);
  return (
    <div className="space-y-2" data-testid={testId ?? 'version-actions'}>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'draft' && onEdit && canWriteProfiles && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit draft
          </Button>
        )}
        {state === 'draft' && canApproveProfiles && (
          <>
            <ApproveButton access={access} size="sm" onClick={() => run('approve')} disabled={transition.isPending} data-testid="approve-version">
              Approve
            </ApproveButton>
            <div className="flex items-center gap-1">
              <Checkbox id={supersedeId} checked={supersede} onCheckedChange={(checked) => setSupersede(checked === true)} data-testid="supersede" />
              <Label htmlFor={supersedeId} className="text-xs">
                Supersede the approved predecessor
              </Label>
            </div>
          </>
        )}
        {canApproveProfiles && (
          <Button size="sm" variant="ghost" onClick={() => run('retire')} disabled={transition.isPending}>
            Retire
          </Button>
        )}
      </div>
      <RefusalNotice error={transition.error} timezone={timezone} />
    </div>
  );
}
