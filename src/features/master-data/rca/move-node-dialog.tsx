import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

/** "Move under…": a new parent (or the top level) for a node and its subtree; keyboard instead of drag. */
export function MoveNodeDialog({ name, targets, currentParentId, onMove, onClose }: MoveNodeDialogProps) {
  const [parent, setParent] = useState(currentParentId ?? TOP);
  const [busy, setBusy] = useState(false);
  const move = async () => {
    setBusy(true);
    try {
      await onMove(parent === TOP ? null : parent);
      onClose();
    } catch {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move {name}</DialogTitle>
          <DialogDescription>Its sub-items move with it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="move-parent">Move under</Label>
          <Select value={parent} onValueChange={setParent}>
            <SelectTrigger id="move-parent">
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || parent === (currentParentId ?? TOP)} onClick={() => void move()}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
