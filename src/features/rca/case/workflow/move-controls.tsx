import { useState } from 'react';
import type { RcaCaseReadinessView } from '@/api/v2/types/rca-workflow';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { RcaErrorAlert } from '../../components/rca-error-alert';
import { blockersOf, moveConfirmation, moveReady, statusSlug, transitionBody, workflowMoves, type WorkflowMove } from '../../model/case-workflow';
import { useCaseTransition } from './use-case-transition';

function TextField(props: { id: string; label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Textarea id={props.id} value={props.value} maxLength={4000} aria-describedby={`${props.id}-hint`} onChange={(e) => props.onChange(e.target.value)} />
      <p id={`${props.id}-hint`} className="text-xs text-muted-foreground">
        {props.hint}
      </p>
    </div>
  );
}

const variantOf = (move: WorkflowMove) => (move.needsNote ? 'outline' : 'default');

/**
 * The moves the server offers from the current status. Approval, rejection and reopening are offered only
 * to an independent manager approver (`approver.canApprove`); the server refuses anyone else anyway.
 */
export function MoveControls({ readiness }: { readiness: RcaCaseReadinessView }) {
  const transition = useCaseTransition();
  const [note, setNote] = useState('');
  const [residualRisk, setResidualRisk] = useState('');
  const [confirming, setConfirming] = useState<WorkflowMove | null>(null);
  const moves = workflowMoves(readiness).filter((move) => !move.needsApprover || readiness.approver.canApprove);
  if (moves.length === 0) return null;
  const input = { note, residualRisk };
  // the panel remounts these controls with the new row version after a move, which clears the inputs
  const run = (move: WorkflowMove) => void transition.move(transitionBody(move, input)).catch(() => null);
  const request = (move: WorkflowMove) => (moveConfirmation(move, readiness.status) ? setConfirming(move) : run(move));
  const confirmation = confirming ? moveConfirmation(confirming, readiness.status) : null;
  return (
    <div className="space-y-3" data-testid="workflow-moves">
      {moves.some((move) => move.needsResidualRisk) && (
        <TextField id="workflow-residual-risk" label="Residual risk (for the closure request)" hint="How the risk that remains is accepted or handled, e.g. spare seal kept on site, monthly vibration check." value={residualRisk} onChange={setResidualRisk} />
      )}
      {moves.some((move) => move.needsNote) && (
        <TextField id="workflow-note" label="Reason (to go back, reject or reopen)" hint="Required for these moves: say why, in a sentence." value={note} onChange={setNote} />
      )}
      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <Button
            key={move.to}
            variant={variantOf(move)}
            disabled={transition.isPending || !moveReady(move, blockersOf(move, readiness, residualRisk), input)}
            onClick={() => request(move)}
            data-testid={`workflow-move-${statusSlug(move.to)}`}
          >
            {move.label}
          </Button>
        ))}
      </div>
      {transition.error ? <RcaErrorAlert error={transition.error} /> : null}
      {confirming && confirmation && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          onConfirm={() => run(confirming)}
        />
      )}
    </div>
  );
}
