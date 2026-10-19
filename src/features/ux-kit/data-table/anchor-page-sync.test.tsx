import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { anchorPageOf } from './anchor-page';
import { DataTable } from './data-table';
import type { DataTableColumn } from './data-table-types';

interface Item {
  id: string;
  name: string;
}
const items = (count: number): Item[] => Array.from({ length: count }, (_, index) => ({ id: `k${index + 1}`, name: `Row ${index + 1}` }));
const columns: ReadonlyArray<DataTableColumn<Item>> = [{ id: 'name', header: 'Name', cell: (row) => row.name }];
const table = (rows: Item[], anchored = true) => (
  <DataTable caption="Items" columns={columns} rows={rows} getRowKey={(row) => row.id} getRowAnchor={anchored ? (row) => `item-${row.id}` : undefined} />
);

describe('deep links into a client-paged DataTable', () => {
  it('computes the page of the anchored row', () => {
    const rows = items(45);
    const anchor = (row: Item) => `item-${row.id}`;
    expect(anchorPageOf(rows, anchor, 'item-k1', 20)).toBe(0);
    expect(anchorPageOf(rows, anchor, 'item-k21', 20)).toBe(1);
    expect(anchorPageOf(rows, anchor, 'item-k45', 20)).toBe(2);
    expect(anchorPageOf(rows, anchor, 'item-none', 20)).toBe(-1);
    expect(anchorPageOf(rows, anchor, '', 20)).toBe(-1);
  });

  it('opens the page holding the linked row, once rows arrive, and leaves paging to the user afterwards', async () => {
    const view = render(<MemoryRouter initialEntries={['/list#item-k33']}>{table([])}</MemoryRouter>);
    view.rerender(<MemoryRouter initialEntries={['/list#item-k33']}>{table(items(45))}</MemoryRouter>);
    expect(await screen.findByText('Row 33')).toBeTruthy();
    expect(document.getElementById('item-k33')).not.toBeNull();
    expect(screen.queryByText('Row 1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(await screen.findByText('Row 1')).toBeTruthy();
    expect(screen.queryByText('Row 33')).toBeNull();
  });

  it('stays on the first page without an anchor, without a matching row or outside a router', () => {
    const first = render(<MemoryRouter initialEntries={['/list#item-missing']}>{table(items(45))}</MemoryRouter>);
    expect(screen.getByText('Row 1')).toBeTruthy();
    first.unmount();
    render(table(items(45)));
    expect(screen.getByText('Row 1')).toBeTruthy();
  });
});
