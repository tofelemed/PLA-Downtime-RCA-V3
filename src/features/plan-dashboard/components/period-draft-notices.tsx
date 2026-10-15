import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { useRetainedDraft } from '../hooks/use-retained-draft';

/** Restore is explicit, stale bases are disclosed, and retention never evicts another unsaved edit. */
export function PeriodDraftNotices({ retained, editable }: { retained: ReturnType<typeof useRetainedDraft>; editable: boolean }) {
  const { number } = useNumberFormat();
  return <>
    {retained.pending && <div role="status" className="space-y-2 rounded-md border border-amber-300 p-3 text-sm">
      <p>An unsaved loss-line draft is available from your earlier visit.</p>
      {retained.changed && <p>Saved figures changed since that draft. Restoring keeps its original version and calculation; a refused save will offer the existing rebase review.</p>}
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={retained.restore}>Restore loss-line draft</Button><Button size="sm" variant="outline" onClick={retained.discard}>Discard retained draft</Button></div>
    </div>}
    {retained.atCapacity && editable && <p role="status" className="text-sm text-amber-700">Twenty unsaved period drafts are already retained. Save or discard one before editing another period.</p>}
    {retained.otherDrafts.length > 0 && <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer">Other unsaved period drafts ({number(retained.otherDrafts.length)})</summary>
      <p className="py-2 text-muted-foreground">Drafts belong to their original revision. An approved or replaced revision cannot restore its earlier edits.</p>
      <ul className="space-y-2">{retained.otherDrafts.map((item, index) => <li key={item.key} className="flex flex-wrap items-center gap-2">
        {item.returnPath && <Link className="underline" to={item.returnPath}>Open retained period {number(index + 1)}</Link>}
        <Button size="sm" variant="outline" onClick={() => retained.discardOther(item.key)}>Discard retained draft {number(index + 1)}</Button>
      </li>)}</ul>
    </details>}
  </>;
}
