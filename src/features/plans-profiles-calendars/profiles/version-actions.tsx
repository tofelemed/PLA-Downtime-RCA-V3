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
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
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

const NOUN: Record<VersionResource, string> = {
  profiles: 'profile version',
  rates: 'rate version',
  'valuation-rates': 'valuation rate',
  'transition-standards': 'transition standard',
  'unit-streams': 'stream version',
  'flow-routes': 'flow route',
};

interface RetireButtonProps {
  resource: VersionResource;
  disabled: boolean;
  error: unknown;
  timezone: string;
  onConfirm: () => Promise<unknown>;
}

function RetireButton({ resource, disabled, error, timezone, onConfirm }: RetireButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost" disabled={disabled}>
          Retire
        </Button>
      }
      title={`Retire this ${NOUN[resource]}?`}
      description="It stays in the history and in the figures already calculated with it, but new plans and calculations cannot use it. This cannot be undone."
      confirmLabel={`Retire ${NOUN[resource]}`}
      destructive
      onConfirm={onConfirm}
    >
      <RefusalNotice error={error} timezone={timezone} />
    </ConfirmDialog>
  );
}

/**
 * Approve / retire of one version. The server decides who may and whether it overlaps an approved
 * version (the conflicting versions are listed inline); "supersede" asks the server to close the one
 * approved predecessor at this version's start. Retiring asks for confirmation first.
 */
export function VersionActions({ resource, id, state, timezone, onEdit, testId, authorId }: VersionActionsProps) {
  const capabilities = useCapabilities();
  // SME V1: valuation rates (margins, costs) are finance's; profiles and rates stay master data
  const finance = resource === 'valuation-rates';
  const canWriteProfiles = finance ? capabilities.canMaintainValuation : capabilities.canWriteProfiles;
  const canApproveProfiles = finance ? capabilities.canApproveValuation : capabilities.canApproveProfiles;
  const access = approvalAccess(canApproveProfiles, authorId, useCurrentUserId());
  const transition = useVersionTransition();
  const [supersede, setSupersede] = useState(false);
  const supersedeId = useId();
  if (state === 'retired') return <span className="text-xs text-muted-foreground">Retired — kept as history</span>;
  if (!canApproveProfiles && !(canWriteProfiles && state === 'draft' && onEdit)) return null;
  const run = (action: 'approve' | 'retire') => transition.submit({ resource, id, action, supersede });
  return (
    <div className="space-y-2" data-testid={testId ?? 'version-actions'}>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'draft' && onEdit && canWriteProfiles && (
          <Button size="sm" variant="outline" onClick={onEdit} data-testid="profile-edit">
            Edit draft
          </Button>
        )}
        {state === 'draft' && canApproveProfiles && (
          <>
            <ApproveButton access={access} size="sm" onClick={() => void run('approve').catch(() => undefined)} disabled={transition.isPending} data-testid="approve-version">
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
        {canApproveProfiles && <RetireButton resource={resource} disabled={transition.isPending} error={transition.error} timezone={timezone} onConfirm={() => run('retire')} />}
      </div>
      <RefusalNotice error={transition.error} timezone={timezone} />
    </div>
  );
}
