import { useRef, type ReactNode } from 'react';
import { focusFirstField } from './focus-first-field';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface EditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** optional line under the title: what saving does (pages that put it behind an ⓘ pass `titleAside` instead) */
  description?: ReactNode;
  /** opt-in: a small element on the title's line, after the title (e.g. an ⓘ with what saving does) */
  titleAside?: ReactNode;
  children: ReactNode;
}

/**
 * A long editor in a panel from the right (plans/SETUP_UX_FIXES.md Phase 4): the page keeps its read-only
 * summary or table, and the editor opens only on its "Record new version" / "New version" action. The panel
 * scrolls on its own; closing it drops the draft.
 */
export function EditorSheet({ open, onOpenChange, title, description, titleAside, children }: EditorSheetProps) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-2xl"
        onOpenAutoFocus={titleAside ? (event) => focusFirstField(body.current, event) : undefined}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <SheetHeader className="pr-6">
          <div className="flex items-center gap-1.5">
            <SheetTitle>{title}</SheetTitle>
            {titleAside}
          </div>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div ref={body} className="mt-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
