import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface EditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** one line under the title: what saving does */
  description: ReactNode;
  children: ReactNode;
}

/**
 * A long editor in a panel from the right (plans/SETUP_UX_FIXES.md Phase 4): the page keeps its read-only
 * summary or table, and the editor opens only on its "Record new version" / "New version" action. The panel
 * scrolls on its own; closing it drops the draft.
 */
export function EditorSheet({ open, onOpenChange, title, description, children }: EditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-6">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
