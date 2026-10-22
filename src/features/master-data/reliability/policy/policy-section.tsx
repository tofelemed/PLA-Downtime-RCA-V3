import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import type { PolicyEditor } from './use-policy-editor';

export interface PolicySectionProps {
  title: string;
  description?: ReactNode;
  editor: PolicyEditor;
  /** the form of a new version; null hides "Record new version" (a reader, or the version in force still loading) */
  form: ReactNode;
  /** the read-only summary of the version in force */
  children: ReactNode;
}

/**
 * One section of Stop and plan policy (plans/SETUP_UX_FIXES.md Phase 4): the version in force as a summary,
 * "Record new version" in the section header opening the form in a side panel, and the result dialog.
 */
export function PolicySection({ title, description, editor, form, children }: PolicySectionProps) {
  const action = form ? (
    <Button type="button" size="sm" variant="outline" aria-label={`Record new version of ${title}`} onClick={() => editor.setOpen(true)}>
      <ActionIcon.edit className="h-4 w-4" aria-hidden="true" />
      Record new version
    </Button>
  ) : null;
  return (
    <Section title={title} description={description} actions={action}>
      {children}
      {form && (
        <EditorSheet
          open={editor.isOpen}
          onOpenChange={editor.setOpen}
          title={`${title}: new version`}
          description="Saving records a new version. Periods already calculated keep the version they used."
        >
          {form}
        </EditorSheet>
      )}
      {editor.saving.feedback.dialog}
    </Section>
  );
}
