import { EmptyMessage } from '@/features/ux-kit/data-table/data-table-states';

/** A centred empty state with its own title and hint (the shared report look would say "No data for these dates"). */
export function CloseEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border px-4 py-10">
      <EmptyMessage empty={{ title, text }} />
    </div>
  );
}
