import { EmptyMessage } from '@/features/ux-kit/data-table/data-table-states';

/** The centred empty state of a per-unit list before a unit is chosen. */
export function ChooseUnitEmpty({ what }: { what: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 py-8" data-testid="choose-unit-empty">
      <EmptyMessage empty={{ title: 'No unit chosen', text: `Choose a unit to see its ${what}.` }} />
    </div>
  );
}
