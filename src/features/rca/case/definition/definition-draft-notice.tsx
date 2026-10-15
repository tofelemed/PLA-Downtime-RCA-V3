import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { DefinitionEditorDraft } from './use-definition-draft';

export function DefinitionDraftNotice({ draft }: { draft: DefinitionEditorDraft }) {
  return <>
    {draft.pending && <div role="status" className="space-y-2 rounded border p-3 text-sm" data-testid="definition-draft-restore">
      <p>An unsaved definition draft is available for this case.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={draft.restore}>Restore definition draft</Button>
        <Button size="sm" variant="outline" onClick={() => draft.reset()}>Discard definition draft</Button>
      </div>
    </div>}
    {(draft.dirty || draft.pending) && draft.changed && <p role="status" className="rounded border border-amber-300 p-3 text-sm">
      The case or plant timezone changed after these edits began. The draft keeps its original version and date basis; a conflicting save will be refused. Discard the draft to load the latest definition.
    </p>}
    {draft.dirty && <p role="status" className="text-sm text-muted-foreground">Unsaved definition changes. You can leave and restore them during this session; confirming a reload or closing this tab loses them.</p>}
    {draft.atCapacity && <div role="status" className="space-y-2 rounded border p-3 text-sm">
      <p>The session has reached its retained definition limit. Save or discard another draft before editing this case.</p>
      <ul className="space-y-2">{draft.otherDrafts.map(item => <li key={item.caseId} className="flex flex-wrap items-center gap-2">
        <Link to={`/rca/${item.caseId}/definition`} className="underline">{item.form.title}</Link>
        <Button size="sm" variant="outline" onClick={() => draft.discardOther(item.caseId)}>Discard draft</Button>
      </li>)}</ul>
    </div>}
  </>;
}
