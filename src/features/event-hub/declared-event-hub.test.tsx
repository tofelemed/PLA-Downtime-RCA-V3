import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { declaredColumns } from './components/declared-columns';
import { DeclaredFields } from './components/declared-fields';
import { DeclaredSummary } from './components/declared-summary';
import { eventColumns, type EventColumnContext } from './components/event-columns';
import { defaultFilters, isToCodeFilters, toCodeFilters, toEventQuery } from './model/event-filters';
import { EMPTY_FORM, toCreateBody, toPatchBody, validateEventForm, type EventFormValues } from './model/event-form';
import { periodLabel } from './model/period-label';
import { factText, type FactResolvers } from './model/fact-display';
import { DEFAULT_CALENDAR_PREFERENCE } from '@/lib/dates/calendar-types';

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canWriteEvents: true }) }));
vi.mock('./components/retract-event-dialog', () => ({ RetractEventDialog: () => <button type="button">Retract</button> }));
vi.mock('./components/split-dialog', () => ({ SplitDialog: () => null }));
vi.mock('./components/close-stop-dialog', () => ({ CloseStopDialog: () => null }));
vi.mock('./components/unit-label', () => ({ UnitLabel: () => null }));
vi.mock('./components/event-state-cell', () => ({ EventStateCell: () => null }));
vi.mock('@/features/ux-kit/use-number-format', () => ({
  useNumberFormat: () => ({ decimal: (value: string) => value, number: (value: number) => String(value), text: (value: string) => value }),
}));

const { EventDetailActions } = await import('./components/event-detail-actions');

const lossDay = {
  id: 'p1', unitId: 'u1', startTime: '2026-10-09T02:30:00.000Z', endTime: '2026-10-10T02:30:00.000Z', isOpen: false, durationSeconds: 86400,
  sourceKind: 'manual', classification: { physicalType: 'production_loss', scheduleClass: 'unplanned' },
  states: { physical: 'closed', coding: 'uncoded', rca: 'none' }, reasonCodeId: null, rowVersion: 1,
  declaredFigures: { planned: 120, actual: 112.5, shortfall: 7.5, uom: 't', measurementQuality: 'GOOD', sourceStatus: 'CONFIRMED', plan: { source: 'ERP', planId: 'P-9', revision: 3, approved: true }, piSource: null },
} as unknown as ProductionEventView;
const stop = { ...lossDay, id: 's1', isOpen: true, durationSeconds: null, classification: { physicalType: 'downtime', scheduleClass: 'unplanned' }, declaredFigures: null } as unknown as ProductionEventView;

const context = (patch: Partial<EventColumnContext> = {}): EventColumnContext => ({
  unitName: () => 'Extruder', reasonName: () => '—', dateTime: () => '2026-10-09 06:00', date: () => '2026-10-09', listSearch: '', prefetch: () => undefined, ...patch,
});
const ids = (ctx: EventColumnContext) => eventColumns(ctx).map((c) => c.id);
const show = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('declared columns', () => {
  it('appear only in declared mode', () => {
    expect(ids(context())).not.toContain('planned');
    expect(ids(context({ declared: true }))).toEqual(expect.arrayContaining(['planned', 'actual', 'lost']));
  });

  it('show tonnes for a production loss row and stay blank for a stop', () => {
    const [planned, actual, lost] = declaredColumns();
    show(<>{planned.cell(lossDay, 0)}{actual.cell(lossDay, 0)}{lost.cell(lossDay, 0)}</>);
    expect(screen.getByTestId('event-declared-planned').textContent).toBe('120');
    expect(screen.getByTestId('event-declared-actual').textContent).toBe('112.5');
    expect(screen.getByTestId('event-declared-shortfall').textContent).toBe('7.5');
    show(<>{lost.cell(stop, 1)}</>);
    expect(screen.getAllByTestId('event-declared-shortfall')).toHaveLength(1);
  });

  it('the Duration cell of a production loss shows the plant date', () => {
    const duration = eventColumns(context()).find((c) => c.id === 'duration')!;
    show(<>{duration.cell(lossDay, 0)}</>);
    expect(screen.getByTestId('event-duration').textContent).toBe('2026-10-09');
  });
});

describe('To code filter in declared mode', () => {
  const window = { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', label: 'October' };
  it('targets uncoded production loss; downtime otherwise', () => {
    expect(toEventQuery(toCodeFilters(defaultFilters(window), true))).toMatchObject({ physicalTypes: ['production_loss'], codingStates: ['uncoded'] });
    expect(toEventQuery(toCodeFilters(defaultFilters(window)))).toMatchObject({ physicalTypes: ['downtime'] });
    expect(isToCodeFilters(toCodeFilters(defaultFilters(window), true), true)).toBe(true);
    expect(isToCodeFilters(toCodeFilters(defaultFilters(window), true))).toBe(false);
  });
});

describe('detail actions', () => {
  it('hide Split and Close stop for a production loss, keep Edit and Retract', () => {
    show(<EventDetailActions event={lossDay} />);
    expect(screen.getByText('Edit / code')).toBeInTheDocument();
    expect(screen.getByText('Retract')).toBeInTheDocument();
    expect(screen.queryByText('Split')).toBeNull();
    expect(screen.queryByText('Close stop')).toBeNull();
  });

  it('keep Split and Close stop for an open stop', () => {
    show(<EventDetailActions event={stop} />);
    expect(screen.getByText('Split')).toBeInTheDocument();
    expect(screen.getByText('Close stop')).toBeInTheDocument();
  });
});

describe('summary', () => {
  it('lists the declared figures, status and OT plan', () => {
    show(<dl><DeclaredSummary figures={lossDay.declaredFigures!} /></dl>);
    expect(screen.getByTestId('declared-shortfall').textContent).toBe('7.5 t');
    expect(screen.getByTestId('declared-status').textContent).toBe('CONFIRMED');
    expect(screen.getByTestId('declared-plan').textContent).toBe('ERP · P-9 · revision 3 · approved');
  });
});

describe('production loss form', () => {
  const base: EventFormValues = { ...EMPTY_FORM, unitId: 'u1', physicalType: 'production_loss', startLocal: '2026-10-09T06:00', endLocal: '2026-10-10T06:00', declaredPlanned: '120', declaredActual: '112.5', declaredShortfall: '7.5', declaredStatus: 'CONFIRMED' };

  it('shows the declared fields and a non-blocking hint when planned - actual differs', () => {
    const setField = vi.fn();
    const { rerender } = render(<DeclaredFields form={{ values: base, errors: {}, setField }} />);
    expect(screen.getByLabelText('Planned (t)')).toBeInTheDocument();
    expect(screen.getByLabelText('Shortfall (t) *')).toBeInTheDocument();
    expect(screen.queryByTestId('declared-identity-hint')).toBeNull();
    rerender(<DeclaredFields form={{ values: { ...base, declaredShortfall: '9' }, errors: {}, setField }} />);
    expect(screen.getByTestId('declared-identity-hint').textContent).toContain('The server will flag this for review');
    fireEvent.change(screen.getByLabelText('OT status'), { target: { value: 'DETECTED' } });
    expect(setField).toHaveBeenCalledWith('declaredStatus', 'DETECTED');
  });

  it('posts exactly the fields the DTO declares', () => {
    expect(toCreateBody(base, 'UTC')).toEqual({
      unitId: 'u1', startTime: '2026-10-09T06:00:00.000Z', endTime: '2026-10-10T06:00:00.000Z', physicalType: 'production_loss', quantity: '7.5',
      declaredFigures: { planned: 120, actual: 112.5, shortfall: 7.5, sourceStatus: 'CONFIRMED' },
    });
  });

  it('requires the shortfall and an end time, and does not block a mismatching identity', () => {
    const errors = validateEventForm({ ...base, declaredShortfall: '', endLocal: '' }, 'create', 'UTC');
    expect(errors.declaredShortfall).toBeTruthy();
    expect(errors.endLocal).toBeTruthy();
    expect(validateEventForm({ ...base, declaredShortfall: '9' }, 'create', 'UTC')).toEqual({});
  });

  it('an edit sends the whole declaredFigures, keeping what the form does not own', () => {
    const edited = { ...base, declaredShortfall: '8', declaredActual: '112' };
    const patch = toPatchBody(base, edited, 'UTC', lossDay);
    expect(patch.declaredFigures).toMatchObject({ planned: 120, actual: 112, shortfall: 8, uom: 't', measurementQuality: 'GOOD', plan: { planId: 'P-9' } });
    expect(toPatchBody(base, base, 'UTC', lossDay).declaredFigures).toBeUndefined();
  });
});

describe('period label', () => {
  it('a day-grain period reads "· Day", a shift keeps "· Shift A"', () => {
    expect(periodLabel('2026-10-29', 'Day', DEFAULT_CALENDAR_PREFERENCE)).toBe('2026-10-29 · Day');
    expect(periodLabel('2026-10-29', 'A', DEFAULT_CALENDAR_PREFERENCE)).toBe('2026-10-29 · Shift A');
    expect(periodLabel('2026-10-29', null, DEFAULT_CALENDAR_PREFERENCE)).toBe('2026-10-29');
  });
});

describe('Values tab: declared figures', () => {
  const resolvers = { decimal: (value: string, digits: number) => Number(value).toFixed(digits) } as unknown as FactResolvers;
  const text = 'Planned 240.000 t · Actual 208.000 t · Shortfall 32.000 t · CONFIRMED';

  it('reads the revision facts (JSON text) as words, not raw JSON', () => {
    const stored = JSON.stringify({ planned: 240, actual: 208, shortfall: 32, uom: 't', measurementQuality: null, sourceStatus: 'CONFIRMED', plan: null, piSource: null });
    expect(factText('declaredFigures', stored, resolvers)).toBe(text);
  });

  it('reads the event row object the same way and leaves other text alone', () => {
    expect(factText('declaredFigures', { planned: 240, actual: 208, shortfall: 32, uom: 't', sourceStatus: 'CONFIRMED', measurementQuality: null, plan: null, piSource: null }, resolvers)).toBe(text);
    expect(factText('declaredFigures', 'not json', resolvers)).toBe('not json');
  });
});
