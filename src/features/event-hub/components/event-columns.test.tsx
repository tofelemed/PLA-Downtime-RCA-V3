import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { eventColumns, type EventColumnContext } from './event-columns';

const event = (id: string, coding: 'uncoded' | 'coded'): ProductionEventView =>
  ({
    id,
    unitId: 'u1',
    startTime: '2026-10-09T06:00:00.000Z',
    classification: { physicalType: 'downtime', scheduleClass: 'unplanned' },
    states: { physical: 'closed', coding, rca: 'none' },
    reasonCodeId: coding === 'coded' ? 'r1' : null,
  }) as ProductionEventView;

const context = (patch: Partial<EventColumnContext>): EventColumnContext => ({
  unitName: () => 'Kiln 1',
  reasonName: (id) => (id ? 'MECH · Mechanical' : '—'),
  dateTime: () => '2026-10-09 06:00',
  listSearch: '',
  prefetch: () => undefined,
  ...patch,
});

const columnOf = (ctx: EventColumnContext, id: string) => eventColumns(ctx).find((c) => c.id === id)!;
const show = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('event columns (FE-06 / FE-07)', () => {
  it('an uncoded row offers "Code" without opening the row; a coded row does not', () => {
    const onCode = vi.fn();
    const onRow = vi.fn();
    const reason = columnOf(context({ onCode }), 'reason');
    show(<div onClick={onRow}>{reason.cell(event('e1', 'uncoded'), 0)}</div>);
    fireEvent.click(screen.getByTestId('event-code'));
    expect(onCode).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    expect(onRow).not.toHaveBeenCalled();
    show(<>{reason.cell(event('e2', 'coded'), 1)}</>);
    expect(screen.getAllByTestId('event-code')).toHaveLength(1);
  });

  it('"select all listed" ticks every loaded row, and unticks them when all are selected', () => {
    const rows = [event('e1', 'uncoded'), event('e2', 'uncoded')];
    const toggleMany = vi.fn();
    const none = context({ rows, selection: { selectedIds: new Set(), toggle: vi.fn(), toggleMany } });
    show(<>{columnOf(none, 'select').header}</>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 2 listed events' }));
    expect(toggleMany).toHaveBeenLastCalledWith(rows, true);
    const all = context({ rows, selection: { selectedIds: new Set(['e1', 'e2']), toggle: vi.fn(), toggleMany } });
    show(<>{columnOf(all, 'select').header}</>);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select all 2 listed events' })[1]);
    expect(toggleMany).toHaveBeenLastCalledWith(rows, false);
  });
});
