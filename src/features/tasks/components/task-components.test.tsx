import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TaskView } from '@/api/v2/types/administration';

const submit = vi.fn(async () => ({}));
vi.mock('@/api/v2/queries/administration-tasks', () => ({ useCompleteTask: () => ({ submit, isPending: false }) }));

const { linkTargetOf, taskColumns } = await import('./task-columns');
const { TaskSummary } = await import('./task-summary');
const { TasksFilterBar } = await import('./tasks-filter-bar');

const TASK: TaskView = {
  id: 't1', title: 'Replace seal', description: null, assigneeId: 'u1', assigneeName: 'Ali', assignedById: 'u2', assignedByName: null,
  priority: 'High', status: 'Open', dueDate: null, completedAt: null, overdue: false, linkType: 'RCA', linkId: 'c1',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

describe('tasks filter bar labels', () => {
  it('Search, Status and Priority labels name their controls', () => {
    const options = [{ value: 'all', label: 'All' }];
    render(<TasksFilterBar values={{ q: '', status: 'all', priority: 'all', mine: '', overdue: '' }} statusOptions={options} priorityOptions={options} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Search')).toHaveAttribute('type', 'search');
    expect(screen.getByLabelText('Status')).toHaveAttribute('role', 'combobox');
    expect(screen.getByLabelText('Priority')).toHaveAttribute('role', 'combobox');
  });
});

describe('task components (U1)', () => {
  it('G-5: links an RCA task straight to its case', () => {
    expect(linkTargetOf(TASK)).toBe('/rca/c1');
    expect(linkTargetOf({ ...TASK, rcaActionId: 'a1' })).toBe('/rca/c1/actions#action-a1');
  });

  it('F-9: asks before marking a task complete, and the dialog click does not open the row', async () => {
    const column = taskColumns(() => '', true).find((c) => c.id === 'complete');
    const onRow = vi.fn();
    render(<div onClick={onRow}>{column?.cell(TASK, 0)}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Replace seal" complete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark complete' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('t1'));
    expect(onRow).not.toHaveBeenCalled();
  });

  it('shows a failed summary as an error with retry instead of loading forever', () => {
    const retry = vi.fn();
    render(<TaskSummary summary={undefined} loading={false} isError error={new Error('down')} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByLabelText('Task counts')).toBeNull();
  });
});
