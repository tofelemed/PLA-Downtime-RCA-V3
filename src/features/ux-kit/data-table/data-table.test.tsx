import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { V2ApiError } from '@/api/v2/errors';
import { DataTable } from './data-table';
import { ListPager } from './data-table-pager';
import type { DataTableColumn } from './data-table-types';
import { PAGE_SIZE_OPTIONS, type PagerModel } from './pager-model';

interface Item {
  id: string;
  name: string;
  qty: number;
}

const items = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({ id: `k${index + 1}`, name: `Row ${index + 1}`, qty: index + 1 }));

const columns: ReadonlyArray<DataTableColumn<Item>> = [
  { id: 'name', header: 'Name', cell: (row) => row.name },
  { id: 'qty', header: 'Quantity', cell: (row) => row.qty, align: 'right' },
];

const bodyRows = () => screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('columnheader').length === 0);

beforeAll(() => {
  // Radix Select uses pointer capture and scrollIntoView, which jsdom does not implement
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => vi.restoreAllMocks());

describe('DataTable client paging', () => {
  it('shows 20 of 45 rows, pages forward and resets to page 1 when the page size changes', async () => {
    const user = userEvent.setup();
    render(<DataTable caption="Items" columns={columns} rows={items(45)} getRowKey={(row) => row.id} />);
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();
    expect(screen.getByText('Row 21')).toBeInTheDocument();
    expect(screen.queryByText('Row 20')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await user.click(screen.getByRole('option', { name: '50' }));
    expect(bodyRows()).toHaveLength(45);
    expect(screen.getByText('1–45 of 45')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('hides the pager when every row fits on the first page', () => {
    render(<DataTable caption="Items" columns={columns} rows={items(15)} getRowKey={(row) => row.id} />);
    expect(bodyRows()).toHaveLength(15);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('names the table with a hidden caption, scopes the headers and keeps the header sticky', () => {
    render(<DataTable caption="Items" columns={columns} rows={items(2)} getRowKey={(row) => row.id} />);
    const table = screen.getByRole('table', { name: 'Items' });
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
    expect(table.querySelector('caption')).toHaveClass('sr-only');
    expect(table.querySelector('thead')).toHaveClass('sticky');
  });
});

describe('DataTable rows and states', () => {
  it('activates a row with the keyboard (Enter and Space) and by click', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Items"
        columns={columns}
        rows={items(3)}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        rowLabel={(row) => `Open ${row.name}`}
      />,
    );
    await user.tab();
    expect(screen.getByRole('row', { name: 'Open Row 1' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.keyboard(' ');
    await user.click(screen.getByRole('row', { name: 'Open Row 3' }));
    expect(onRowClick.mock.calls.map(([row]) => (row as Item).id)).toEqual(['k1', 'k2', 'k3']);
  });

  it('shows skeleton rows while loading and no pager', () => {
    render(<DataTable caption="Items" columns={columns} rows={[]} getRowKey={(row) => row.id} status={{ isLoading: true }} />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the default and a custom empty state', () => {
    const view = render(<DataTable caption="Items" columns={columns} rows={[]} getRowKey={(row) => row.id} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Nothing matches the current filters.')).toBeInTheDocument();
    view.rerender(
      <DataTable
        caption="Items"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        empty={{ title: 'No units yet', action: <button type="button">Add unit</button> }}
      />,
    );
    expect(screen.getByText('No units yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add unit' })).toBeInTheDocument();
  });

  it('shows the error state with retry instead of the table', async () => {
    const onRetry = vi.fn();
    const error = new V2ApiError(500, { code: 'INTERNAL', message: 'boom', correlationId: null, retryable: true });
    render(<DataTable caption="Items" columns={columns} rows={[]} getRowKey={(row) => row.id} status={{ isError: true, error, onRetry }} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps rows visible under a refresh bar while refreshing', () => {
    render(<DataTable caption="Items" columns={columns} rows={items(3)} getRowKey={(row) => row.id} status={{ isRefreshing: true }} />);
    expect(screen.getByRole('progressbar', { name: 'Refreshing' })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
  });

  it('virtualizes long unpaged lists: only a window of rows is rendered', () => {
    // jsdom has no layout: give the scroll box its 360 px viewport
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 360));
    render(
      <DataTable
        caption="Signals"
        columns={columns}
        rows={items(500)}
        getRowKey={(row) => row.id}
        pager="none"
        virtualize={{ rowHeight: 36, height: 360 }}
      />,
    );
    const table = screen.getByRole('table', { name: 'Signals' });
    expect(table).toHaveAttribute('aria-rowcount', '501');
    const rendered = bodyRows();
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(50);
    expect(rendered[0]).toHaveAttribute('aria-rowindex', '2');
  });
});

describe('ListPager', () => {
  const base: PagerModel = {
    pageIndex: 0,
    pageSize: 20,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPageSize: () => undefined,
    canPrevious: false,
    canNext: true,
    previous: () => undefined,
    next: () => undefined,
    first: () => undefined,
    pageCount: null,
    totalCount: null,
    rangeStart: 1,
    rangeEnd: 20,
    isFetchingPage: false,
    mode: 'pages',
  };

  it('shows an open-ended range and "Page N" when the total is unknown', () => {
    render(<ListPager pager={base} label="Events pages" />);
    expect(screen.getByRole('navigation', { name: 'Events pages' })).toBeInTheDocument();
    expect(screen.getByText('1–20')).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Last page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('append mode shows the count and a "Show more" button', async () => {
    const loadMore = vi.fn();
    const pager: PagerModel = { ...base, mode: 'append', canNext: false, rangeEnd: 40, hasMore: true, loadMore };
    render(<ListPager pager={pager} />);
    expect(screen.getByText('Showing 40')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(loadMore).toHaveBeenCalledOnce();
  });
});
