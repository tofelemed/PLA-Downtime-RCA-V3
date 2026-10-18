import type { ApprovalChangeField } from '@/api/v2/types/approvals';
import { ChangeValue } from './change-value';

/**
 * The one-line change of an inbox row: "Rate 28 → 29 t/h" against the approved predecessor, or the
 * leading value ("Class scrap") when the record has none.
 */
export function ChangeHeadline({ field }: { field: ApprovalChangeField }) {
  return (
    <p className="text-sm" data-testid="approval-headline">
      <span className="font-medium">{field.label}</span>{' '}
      {field.changed ? (
        <>
          <ChangeValue field={field} value={field.before} /> <span aria-hidden="true">→</span>
          <span className="sr-only">changes to</span> <ChangeValue field={field} value={field.after} />
        </>
      ) : (
        <ChangeValue field={field} value={field.after} />
      )}
    </p>
  );
}
