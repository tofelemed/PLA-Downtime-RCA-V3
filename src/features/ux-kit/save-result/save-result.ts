/** A page the result dialog links to. */
export interface SaveLink {
  label: string;
  path: string;
}

/**
 * What a successful create, new version or import reports (DECISIONS 2026-10-22 "Save feedback").
 * Shown by `SaveResultDialog` / `useSaveResult`; small edits and approvals use a toast instead.
 */
export interface SaveResult {
  /** what happened, e.g. "Unit created", "Version 3 submitted", "42 rates imported" */
  title: string;
  /** the record's name and code, e.g. "Extruder 3 (EXT-3)" */
  recordLabel?: string;
  /** one short line of what happened or what it means */
  message?: string;
  /** the saved record's page: a "View …" link */
  viewPath?: string;
  /** text of the view link (default "View"), e.g. "View unit" */
  viewLabel?: string;
  /** the list the record belongs to: "Back to <listLabel>" */
  listPath: string;
  listLabel: string;
  /** "Add another": a fresh create page, or a reset of the current form (when the path would not change) */
  addAnotherPath?: string;
  onAddAnother?: () => void;
  /** the next setup page (`nextSetupLink`): "Next: <label>", the primary action unless `primaryAction` is set */
  next?: SaveLink | null;
  /** an action of its own that replaces Next as the primary one, e.g. "Switch to Plant B" */
  primaryAction?: { label: string; onSelect: () => void };
  /** Esc, the close button or the overlay (no action chosen); default: stay where you are */
  onDismiss?: () => void;
}

export type SaveActionId = 'view' | 'add-another' | 'list' | 'next' | 'primary';

/** One button of the dialog: a link (`path`), a callback, or both (the link runs `onSelect` too). */
export interface SaveAction {
  id: SaveActionId;
  label: string;
  path?: string;
  onSelect?: () => void;
  primary: boolean;
}

function primaryIdOf(result: SaveResult, withList: boolean): SaveActionId | null {
  if (result.primaryAction) return 'primary';
  if (result.next) return 'next';
  if (result.viewPath) return 'view';
  if (withList) return 'list';
  return result.addAnotherPath || result.onAddAnother ? 'add-another' : null;
}

/** true when `path` names the page `currentPath` (pathname + search) already shows; the hash is ignored */
function isCurrentPage(path: string, currentPath: string | undefined): boolean {
  if (currentPath === undefined) return false;
  const withoutHash = (value: string) => value.split('#')[0];
  return withoutHash(path) === withoutHash(currentPath);
}

/**
 * The dialog's buttons in reading order: View · Add another · Back to list · Next / own action. The primary
 * one (own action, else Next, else View, else Back) comes last, where the eye ends and focus starts.
 * `currentPath` (pathname + search) drops "Back to …" when the list is the page already shown: dismissing
 * the dialog stays there anyway.
 */
export function saveResultActions(result: SaveResult, currentPath?: string): SaveAction[] {
  const withList = !isCurrentPage(result.listPath, currentPath);
  const actions: Array<Omit<SaveAction, 'primary'>> = [];
  if (result.viewPath) actions.push({ id: 'view', label: result.viewLabel ?? 'View', path: result.viewPath });
  if (result.addAnotherPath || result.onAddAnother) {
    actions.push({ id: 'add-another', label: 'Add another', path: result.addAnotherPath, onSelect: result.onAddAnother });
  }
  if (withList) actions.push({ id: 'list', label: `Back to ${result.listLabel}`, path: result.listPath });
  if (result.next) actions.push({ id: 'next', label: `Next: ${result.next.label}`, path: result.next.path });
  if (result.primaryAction) actions.push({ id: 'primary', label: result.primaryAction.label, onSelect: result.primaryAction.onSelect });
  const primaryId = primaryIdOf(result, withList);
  const marked = actions.map((action) => ({ ...action, primary: action.id === primaryId }));
  return [...marked.filter((action) => !action.primary), ...marked.filter((action) => action.primary)];
}
