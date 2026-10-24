import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataState } from '../data-state';
import { DataTable } from '../data-table';
import { ReportLookContext, type ReportLook } from './use-report-look';

const wrap = (look: ReportLook, node: ReactNode) => render(<ReportLookContext.Provider value={look}>{node}</ReportLookContext.Provider>);
const table = <DataTable caption="Overdue" columns={[{ id: 'a', header: 'A', cell: () => 'x' }]} rows={[]} getRowKey={() => 'k'} empty={{ text: 'Nothing overdue.' }} />;

describe('report look: own empty messages (opt-in `ownEmpty`)', () => {
  it('Reports (default): tables and states say the generic "No data for these dates" whatever their own text', () => {
    wrap({ provisional: false }, <>{table}<DataState state="empty" detail="No loss lines in this scope." /></>);
    expect(screen.getAllByText('No data for these dates')).toHaveLength(2);
    expect(screen.queryByText('Nothing overdue.')).toBeNull();
  });

  it('`ownEmpty`: a table or state with its own text shows it centred, without the "try other dates" hint', () => {
    wrap({ provisional: false, ownEmpty: true }, <>{table}<DataState state="empty" detail="No loss lines in this scope." /><DataState state="empty" /></>);
    expect(screen.getByText('Nothing overdue.')).toBeInTheDocument();
    expect(screen.getByText('No loss lines in this scope.')).toBeInTheDocument();
    // a state without its own text keeps the generic one
    expect(screen.getAllByText('No data for these dates')).toHaveLength(1);
    expect(screen.getAllByTestId('own-empty')).toHaveLength(2);
  });

  it('`ownEmpty`: a table keeps the action of its empty state (e.g. "Clear filters")', () => {
    const withAction = <DataTable caption="Cases" columns={[{ id: 'a', header: 'A', cell: () => 'x' }]} rows={[]} getRowKey={() => 'k'} empty={{ text: 'No case matches.', action: <button type="button">Clear filters</button> }} />;
    wrap({ provisional: false, ownEmpty: true }, withAction);
    expect(screen.getByText('No case matches.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
