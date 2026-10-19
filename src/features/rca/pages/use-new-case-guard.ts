import { useCallback } from 'react';
import { DEFAULT_UNSAVED_MESSAGE, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';

/**
 * QA L12: a new-investigation form with typed values asks before it is left — links, back / forward and
 * reload through the shared guard, and Cancel (a programmatic navigation) through the returned check.
 */
export function useNewCaseGuard(dirty: boolean): () => boolean {
  useUnsavedChangesGuard(dirty);
  return useCallback(() => !dirty || window.confirm(DEFAULT_UNSAVED_MESSAGE), [dirty]);
}

/** Why "Create investigation" is disabled while the title is empty (shown next to the button). */
export const TITLE_REQUIRED_REASON = 'Enter a title to create the investigation.';
