import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RcaCard } from '@/features/rca/components/rca-card';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import { ActionIcon } from '@/lib/icons';
import { COMPACT_FIELDS } from '../../components/compact-fields';
import type { PolicyEditor } from './use-policy-editor';

/** What saving a policy version does, behind the ⓘ of its side panel. */
export const NEW_VERSION_INFO = 'Saving records a new version. Periods already calculated keep the version they used.';

export interface PolicySectionProps {
  title: string;
  /** what the section means, behind the ⓘ next to its title */
  info?: ReactNode;
  editor: PolicyEditor;
  /** the form of a new version; null hides "Record new version" (a reader, or the version in force still loading) */
  form: ReactNode;
  /** the read-only summary of the version in force */
  children: ReactNode;
}

/**
 * One card of Stop and plan policy (plans/SETUP_UX_FIXES.md Phase 4): the version in force as a summary,
 * "Record new version" at the right of the title opening the form in a side panel, and the result dialog.
 */
export function PolicySection({ title, info, editor, form, children }: PolicySectionProps) {
  const action = form ? (
    <Button type="button" size="sm" variant="outline" aria-label={`Record new version of ${title}`} onClick={() => editor.setOpen(true)}>
      <ActionIcon.edit className="h-4 w-4" aria-hidden="true" />
      Record new version
    </Button>
  ) : null;
  return (
    <RcaCard title={title} info={info} actions={action}>
      {children}
      {form && (
        <EditorSheet
          open={editor.isOpen}
          onOpenChange={editor.setOpen}
          title={`${title}: new version`}
          titleAside={<KpiInfo label="new versions" text={NEW_VERSION_INFO} />}
        >
          <div className={COMPACT_FIELDS}>{form}</div>
        </EditorSheet>
      )}
      {editor.saving.feedback.dialog}
    </RcaCard>
  );
}
