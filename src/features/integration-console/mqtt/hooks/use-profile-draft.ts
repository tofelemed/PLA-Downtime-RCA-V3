import { useState } from 'react';
import { useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { profileDraftErrors, profileDraftOf, profilePatchOf, type DraftErrors, type MapRow, type ProfileDraft } from '../model/profile-draft';

export interface ProfileEditor {
  draft: ProfileDraft;
  errors: DraftErrors;
  /** the merge patch the save would send (null = nothing changed) */
  patch: Record<string, unknown> | null;
  change: (patch: Partial<ProfileDraft>) => void;
  setRows: (key: 'fields' | 'stateMap' | 'reasonMap', rows: MapRow[]) => void;
  reset: () => void;
  save: () => Promise<void>;
  savedAt: string | null;
  failed: unknown;
  isPending: boolean;
}

/**
 * Payload profile editor state: a draft of the stored profile, client-side rules (the state map must
 * keep running or stopped reachable), and the save as `payloadProfilePatch` under If-Match — the
 * transport block is never sent, so a value-map edit cannot wipe the topics.
 */
export function useProfileDraft(connection: ConnectionView): ProfileEditor {
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraftOf(connection));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const update = useUpdateConnection();
  const errors = profileDraftErrors(draft);
  const patch = profilePatchOf(connection, draft);
  const change = (next: Partial<ProfileDraft>) => setDraft((current) => ({ ...current, ...next }));
  const setRows = (key: 'fields' | 'stateMap' | 'reasonMap', rows: MapRow[]) => setDraft((current) => ({ ...current, [key]: rows }));
  const reset = () => {
    setDraft(profileDraftOf(connection));
    update.reset();
  };
  const save = async () => {
    if (!patch || Object.keys(errors).length > 0) return;
    const saved = await update.submit({ connection, body: { payloadProfilePatch: patch } }).catch(() => null);
    if (!saved) return;
    setDraft(profileDraftOf(saved));
    setSavedAt(new Date().toISOString());
  };
  return { draft, errors, patch, change, setRows, reset, save, savedAt, failed: update.error, isPending: update.isPending };
}
