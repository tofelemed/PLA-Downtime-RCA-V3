import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/features/ux-kit/data-table';

/** Checkbox selection of table rows (bulk actions); the column is labelled for screen readers. */
export function useRowSelection<T extends { id: string }>(rowName: (row: T) => string) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)));
  const column: DataTableColumn<T> = {
    id: 'select',
    header: '',
    headerLabel: 'Select',
    width: '3rem',
    cell: (row) => (
      <Checkbox
        checked={selected.includes(row.id)}
        onCheckedChange={(checked) => toggle(row.id, checked === true)}
        aria-label={`Select ${rowName(row)}`}
      />
    ),
  };
  return { selected, clear: () => setSelected([]), column };
}
