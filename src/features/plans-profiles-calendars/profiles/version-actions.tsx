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
import { useSaveFeedback, type SaveFeedback } from '@/features/ux-kit/save-result';
import { SaveRefusalAlert } from '../components/save-refusal-alert';

export interface VersionActionsProps {
  resource: VersionResource;
  id: string;
  state: VersionState;
  timezone: string;
  /** shown for drafts only (approved versions are immutable: add a new version instead) */
  onEdit?: () => void;
  testId?: string;
  /** author of the version: only SuperAdmin may approve its own version */
  authorId?: string | null;
}

const NOUN: Record<VersionResource, string> = {
  profiles: 'profile version',
  rates: 'rate version',
  'valuation-rates': 'valuation rate',
  'transition-standards': 'transition standard',
  'unit-streams': 'stream version',
  'flow-routes': 'flow route',
  'unit-impact-rules': 'unit impact rule',
};

/** "Rate version approved", "Unit impact rule retired" (the toast of a transition). */
function transitionToast(resource: VersionResource, action: 'approve' | 'retire'): string {
  const noun = NOUN[resource];
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${action === 'approve' ? 'approved' : 'retired'}`;
}

interface RetireButtonProps {
  resource: VersionResource;
  disabled: boolean;
  feedback: SaveFeedback;
  timezone: string;
  onOpen: () => void;
  onConfirm: () => Promise<unknown>;
}

/** Retire behind a confirmation; a refusal shows inside the dialog, which stays open. */
function RetireButton({ resource, disabled, feedback, timezone, onOpen, onConfirm }: RetireButtonProps) {
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
      onOpenChange={(open) => open && onOpen()}
      onConfirm={onConfirm}
    >
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
    </ConfirmDialog>
  );
}

/**
 * Approve / retire of one version. The server decides who may and whether it overlaps an approved
 * version; "supersede" asks the server to close the one approved predecessor at this version's start.
 * Retiring asks for confirmation first. Success is a toast; a refusal (with the conflicting versions of an
 * overlap) shows once, where the action happened: an approve refusal next to the buttons, a retire
 * refusal inside the confirmation.
 */
export function VersionActions({ resource, id, state, timezone, onEdit, testId, authorId }: VersionActionsProps) {
  const capabilities = useCapabilities();
  // SME V1: valuation rates (margins, costs) are finance's; profiles and rates stay master data
  const finance = resource === 'valuation-rates';
  const canWriteProfiles = finance ? capabilities.canMaintainValuation : capabilities.canWriteProfiles;
  const canApproveProfiles = finance ? capabilities.canApproveValuation : capabilities.canApproveProfiles;
  const access = approvalAccess(canApproveProfiles, authorId, useCurrentUserId(), capabilities.isSuperAdmin);
  const transition = useVersionTransition();
  const approveFeedback = useSaveFeedback();
  const retireFeedback = useSaveFeedback();
  const [supersede, setSupersede] = useState(false);
  const supersedeId = useId();
  if (state === 'retired') return <span className="text-xs text-muted-foreground">Retired — kept as history</span>;
  if (!canApproveProfiles && !(canWriteProfiles && state === 'draft' && onEdit)) return null;
  const run = (action: 'approve' | 'retire') => transition.submit({ resource, id, action, supersede });
  const approve = () => void approveFeedback.run(() => run('approve'), transitionToast(resource, 'approve')).catch(() => undefined);
  const openRetire = () => {
    approveFeedback.clearFailure();
    retireFeedback.clearFailure();
  };
  return (
    <div className="space-y-2" data-testid={testId ?? 'version-actions'}>
      <SaveRefusalAlert error={approveFeedback.failure} timezone={timezone} />
      <div className="flex flex-wrap items-center gap-2">
        {state === 'draft' && onEdit && canWriteProfiles && (
          <Button size="sm" variant="outline" onClick={onEdit} data-testid="profile-edit">
            Edit draft
          </Button>
        )}
        {state === 'draft' && canApproveProfiles && (
          <>
            <ApproveButton access={access} size="sm" onClick={approve} disabled={transition.isPending} data-testid="approve-version">
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
          <RetireButton
            resource={resource}
            disabled={transition.isPending}
            feedback={retireFeedback}
            timezone={timezone}
            onOpen={openRetire}
            onConfirm={() => retireFeedback.run(() => run('retire'), transitionToast(resource, 'retire'))}
          />
        )}
      </div>
    </div>
  );
}
