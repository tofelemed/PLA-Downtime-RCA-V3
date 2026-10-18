import { useState } from 'react';
import type { ApprovalChangeField, ApprovalChanges, ApprovalItem } from '@/api/v2/types/approvals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ChangeValue } from './change-value';
import { useApprovalChanges } from './use-approval-changes';

/** Money fields of one figure come in each reporting currency; only the display currency is shown. */
function inDisplayCurrency(fields: readonly ApprovalChangeField[], currency: string): ApprovalChangeField[] {
  const groups = new Map<string, ApprovalChangeField[]>();
  fields.forEach((field) => field.group && groups.set(field.group, [...(groups.get(field.group) ?? []), field]));
  const shown = new Set([...groups.values()].flatMap((group) => entriesInCurrency(group, (f) => f.currency, currency)));
  return fields.filter((field) => !field.group || shown.has(field));
}

function Row({ field, view }: { field: ApprovalChangeField; view: ApprovalChanges }) {
  const twoSided = view.mode !== 'full';
  return (
    <tr className={field.changed ? 'bg-primary/5 font-medium' : undefined} data-testid="approval-change-row" data-changed={field.changed}>
      <th scope="row" className="px-2 py-1.5 text-left align-top font-normal">
        {field.label}
        {field.changed && <Badge variant="outline" className="ml-2">Changed</Badge>}
      </th>
      {twoSided && <td className="px-2 py-1.5 align-top"><ChangeValue field={field} value={field.before} /></td>}
      <td className="px-2 py-1.5 align-top"><ChangeValue field={field} value={field.after} /></td>
    </tr>
  );
}

function intro(view: ApprovalChanges, changedCount: number): string {
  if (view.mode === 'full') return 'This record has no approved predecessor: everything below is new and needs your approval.';
  if (view.mode === 'compare') return `${view.afterLabel} next to the ${view.beforeLabel?.toLowerCase() ?? 'other record'}.`;
  return changedCount === 0
    ? 'No field differs from the approved version (only the version itself is new).'
    : `${changedCount} field${changedCount === 1 ? '' : 's'} differ from the ${view.beforeLabel?.toLowerCase() ?? 'approved version'}.`;
}

function ChangesTable({ view }: { view: ApprovalChanges }) {
  const { currency } = useDisplayCurrency();
  const [showAll, setShowAll] = useState(false);
  const fields = inDisplayCurrency(view.fields, currency);
  const changed = fields.filter((field) => field.changed);
  const hideUnchanged = view.mode === 'diff' && changed.length > 0 && !showAll;
  const rows = hideUnchanged ? changed : fields;
  return (
    <div className="space-y-2" data-testid="approval-changes" data-mode={view.mode}>
      <p className="text-sm text-muted-foreground">{intro(view, changed.length)}</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <caption className="sr-only">What needs approval, field by field</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 text-left font-normal">Field</th>
              {view.mode !== 'full' && <th scope="col" className="px-2 py-1.5 text-left font-normal">{view.beforeLabel}</th>}
              <th scope="col" className="px-2 py-1.5 text-left font-normal">{view.afterLabel}</th>
            </tr>
          </thead>
          <tbody>{rows.map((field) => <Row key={field.key} field={field} view={view} />)}</tbody>
        </table>
      </div>
      {view.mode === 'diff' && changed.length > 0 && fields.length > changed.length && (
        <Button variant="link" size="sm" className="px-0" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show only what changes' : `Show unchanged fields (${fields.length - changed.length})`}
        </Button>
      )}
    </div>
  );
}

/** "Exactly the value needing approval": the pending fields against the approved / effective predecessor. */
export function ApprovalChangesPanel({ item }: { item: ApprovalItem }) {
  const query = useApprovalChanges(item);
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {query.data && <ChangesTable view={query.data} />}
    </DataState>
  );
}
