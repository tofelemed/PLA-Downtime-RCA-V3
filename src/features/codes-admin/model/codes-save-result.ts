import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import type { RuleView } from '@/api/v2/types/rules';
import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import { singularLabel } from './code-fields';

export const CODES_PAGE = '/master-data/codes-rules';
export const RULES_LIST_PATH = `${CODES_PAGE}?tab=rules`;
/** The code-library list's name in the area's tab row, Back buttons and result dialogs. */
export const CODES_LIST_LABEL = 'Code libraries';

/** The library list a code belongs to (`?library=` keeps the chosen library). */
export const libraryListPath = (library: CodeLibraryPath) => `${CODES_PAGE}?library=${library}`;
export const codePagePath = (library: CodeLibraryPath, id: string) => `${CODES_PAGE}/${library}/${id}`;
export const rulePagePath = (id: string) => `${CODES_PAGE}/rules/${id}`;

export interface CreatedResultOptions {
  capabilities: Capabilities;
  onAddAnother: () => void;
  onDismiss?: () => void;
}

/** Result dialog of a new code: View code · Add another · Back to Code libraries · Next: <setup page>. */
export function codeCreatedResult(library: CodeLibraryPath, created: CodeDetailView, options: CreatedResultOptions): SaveResult {
  return {
    title: `${singularLabel(library)} created`,
    recordLabel: `${created.name} (${created.code})`,
    message: 'It is live now and can be chosen on events. Every later change is a new version.',
    viewPath: codePagePath(library, created.id),
    viewLabel: 'View code',
    listPath: libraryListPath(library),
    listLabel: CODES_LIST_LABEL,
    onAddAnother: options.onAddAnother,
    next: nextSetupLink(CODES_PAGE, { capabilities: options.capabilities }),
    onDismiss: options.onDismiss,
  };
}

/** Result dialog of a new rule draft: View rule · Add another · Back to Rules · Next: <setup page>. */
export function ruleCreatedResult(created: RuleView, options: CreatedResultOptions): SaveResult {
  return {
    title: 'Rule draft created',
    recordLabel: created.name,
    message: 'It applies only after a second person activates it.',
    viewPath: rulePagePath(created.id),
    viewLabel: 'View rule',
    listPath: RULES_LIST_PATH,
    listLabel: 'Rules',
    onAddAnother: options.onAddAnother,
    next: nextSetupLink(CODES_PAGE, { capabilities: options.capabilities }),
    onDismiss: options.onDismiss,
  };
}
