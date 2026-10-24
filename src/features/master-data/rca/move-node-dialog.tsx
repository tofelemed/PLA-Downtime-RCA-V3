import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { focusFirstField } from '@/features/ux-kit/focus-first-field';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors/friendly-error-alert';

const TOP = '__top__';

export interface MoveTarget {
  id: string;
  label: string;
}

export interface MoveNodeDialogProps {
  /** name of what is moved, e.g. "Seal failure" */
  name: string;
  /** possible new parents (the item's own subtree already left out) */
  targets: readonly MoveTarget[];
  currentParentId: string | null;
  onMove: (parentId: string | null) => void | Promise<unknown>;
  onClose: () => void;
}

/**
 * "Move under…": a new parent (or the top level) for a node and its subtree; keyboard instead of drag.
 * A refused move stays open and says why (in plain language) so the user can pick another parent.
 */
export function MoveNodeDialog({ name, targets, currentParentId, onMove, onClose }: MoveNodeDialogProps) {
  const [parent, setParent] = useState(currentParentId ?? TOP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const body = useRef<HTMLDivElement>(null);
  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMove(parent === TOP ? null : parent);
      onClose();
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined} onOpenAutoFocus={(event) => focusFirstField(body.current, event)}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>Move {name}</DialogTitle>
            <KpiInfo label="moving" text="Its sub-items move with it." />
          </div>
        </DialogHeader>
        <div ref={body} className="space-y-1.5">
          <Label htmlFor="move-parent">Move under</Label>
          <Select value={parent} onValueChange={setParent}>
            <SelectTrigger id="move-parent" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP}>Top level</SelectItem>
              {targets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error !== null && <FriendlyErrorAlert error={error} title={`Could not move ${name}`} />}
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-9" disabled={busy || parent === (currentParentId ?? TOP)} onClick={() => void move()}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
