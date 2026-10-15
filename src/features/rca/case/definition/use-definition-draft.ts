import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { sessionAuthorityKey } from '@/features/auth/session-authority-key';
import { formFromCase, type RcaCaseForm } from '../../model/rca-form';
import { retainedDefinitionDrafts, type DefinitionDraft } from './retained-definition-drafts';

export function useRcaDraftOwner() {
  const { session } = useAuth();
  const tenantId = useV2TenantId();
  return session && tenantId ? `${sessionAuthorityKey(session.user)}:${tenantId}` : null;
}

const snapshot = (rca: RcaCaseView, timezone: string): DefinitionDraft => ({ form: formFromCase(rca, timezone), rowVersion: rca.rowVersion, timezone });

/** Restored edits retain their original version and date interpretation until saved or discarded. */
export function useDefinitionDraft(rca: RcaCaseView, timezone: string, editable: boolean) {
  const owner = useRcaDraftOwner();
  const [state, setState] = useState(() => snapshot(rca, timezone));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(() => editable ? retainedDefinitionDrafts.read(owner, rca.id) : null);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!editable || pending) return;
    if (dirty) retainedDefinitionDrafts.write(owner, rca.id, state);
    else retainedDefinitionDrafts.clear(owner, rca.id);
  }, [editable, pending, dirty, owner, rca.id, state]);
  useEffect(() => {
    if (!dirty && !pending) setState(snapshot(rca, timezone));
  }, [rca, timezone, dirty, pending]);
  const atCapacity = retainedDefinitionDrafts.atCapacity(owner, rca.id);
  const reset = (next = rca) => {
    retainedDefinitionDrafts.clear(owner, rca.id);
    setPending(null);
    setDirty(false);
    setState(snapshot(next, timezone));
  };
  return {
    ...state, dirty, pending: editable ? pending : null, atCapacity,
    editable: editable && !pending && !atCapacity,
    changed: (pending ?? state).rowVersion !== rca.rowVersion || (pending ?? state).timezone !== timezone,
    change: (patch: Partial<RcaCaseForm>) => { setState(current => ({ ...current, form: { ...current.form, ...patch } })); setDirty(true); },
    restore: () => { if (editable && pending) { setState(pending); setDirty(true); setPending(null); } },
    reset,
    otherDrafts: retainedDefinitionDrafts.list(owner).filter(item => item.caseId !== rca.id),
    discardOther: (caseId: string) => { retainedDefinitionDrafts.clear(owner, caseId); refresh(n => n + 1); },
  };
}

export type DefinitionEditorDraft = ReturnType<typeof useDefinitionDraft>;
