import type { RcaCaseForm } from '../../model/rca-form';

export interface DefinitionDraft {
  form: RcaCaseForm;
  rowVersion: number;
  timezone: string;
}

export const MAX_DEFINITION_DRAFTS = 20;
let owner: string | null = null;
const entries = new Map<string, DefinitionDraft>();

/** Definition edits are session-memory only, bounded without evicting unfinished work. */
export const retainedDefinitionDrafts = {
  setOwner(next: string | null) { if (owner !== next) { entries.clear(); owner = next; } },
  read(scope: string | null, caseId: string) { return scope && scope === owner ? entries.get(caseId) ?? null : null; },
  write(scope: string | null, caseId: string, draft: DefinitionDraft) {
    if (scope && scope === owner && (entries.has(caseId) || entries.size < MAX_DEFINITION_DRAFTS)) entries.set(caseId, draft);
  },
  clear(scope: string | null, caseId: string) { if (scope === owner) entries.delete(caseId); },
  list(scope: string | null) { return scope && scope === owner ? [...entries].map(([caseId, draft]) => ({ caseId, ...draft })) : []; },
  atCapacity(scope: string | null, caseId: string) { return scope === owner && !entries.has(caseId) && entries.size >= MAX_DEFINITION_DRAFTS; },
  hasPending() { return entries.size > 0; },
};
