import type { ProfileView } from '@/api/v2/types/profiles';
import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import type { PlanningRefs } from '../hooks/use-planning-refs';

const PROFILES_LIST = { to: '/setup/profiles', label: 'Profiles & rates' } as const;

export interface ProfileCreatedInput {
  saved: ProfileView;
  refs: Pick<PlanningRefs, 'unitName' | 'productName'>;
  capabilities: Capabilities;
  onAddAnother: () => void;
  /** Esc / close: open the new profile, so a second "Save draft" cannot create it twice */
  onDismiss: () => void;
  /** "Back to Profiles & rates": the list as the user left it (`?back=`: tab, unit, product); default the list */
  listPath?: string;
}

/** The result dialog of a new draft profile version: View profile · Add another · Back to Profiles & rates · Next. */
export function profileCreatedResult({ saved, refs, capabilities, onAddAnother, onDismiss, listPath = PROFILES_LIST.to }: ProfileCreatedInput): SaveResult {
  return {
    title: 'Draft profile version created',
    recordLabel: `${refs.unitName(saved.unitId)} · ${refs.productName(saved.productId)} — version ${saved.version}`,
    message: 'Add its planning and sustained rates on the profile page; a manager approver approves the version.',
    viewPath: `/planning/profiles/${saved.id}`,
    viewLabel: 'View profile',
    listPath,
    listLabel: PROFILES_LIST.label,
    onAddAnother,
    next: nextSetupLink(PROFILES_LIST.to, { unitId: saved.unitId, capabilities }),
    onDismiss,
  };
}
