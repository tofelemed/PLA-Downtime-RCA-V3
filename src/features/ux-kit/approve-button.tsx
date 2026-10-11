import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SEPARATION_OF_DUTIES_HINT, type ApprovalAccess } from '@/features/auth/approval-gate';

export interface ApproveButtonProps extends ComponentProps<typeof Button> {
  access: ApprovalAccess;
}

/**
 * An approve control by `approvalAccess`: not rendered when the role can never approve; disabled with the
 * separation-of-duties tooltip for the author; a plain button otherwise. The server still decides.
 */
export function ApproveButton({ access, disabled, ...props }: ApproveButtonProps) {
  if (access === 'hidden') return null;
  if (access === 'allowed') return <Button disabled={disabled} {...props} />;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex" data-testid="sod-disabled" title={SEPARATION_OF_DUTIES_HINT}>
            <Button {...props} disabled aria-disabled data-sod="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{SEPARATION_OF_DUTIES_HINT}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
