import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DowntimePageProps } from './page-types';

const mode = vi.hoisted(() => ({ isDeclared: false }));
vi.mock('@/features/accounting-mode/use-loss-accounting-mode', () => ({ useLossAccountingMode: () => ({ isDeclared: mode.isDeclared, isDay: false, isLoading: false }) }));
vi.mock('../components/lost-production-pareto', () => ({ LostProductionPareto: () => <div data-testid="lost-production" /> }));
vi.mock('../components/reason-pareto', () => ({ ReasonPareto: () => <div data-testid="reason-pareto" /> }));
vi.mock('../components/bad-actors', () => ({ BadActors: () => <div data-testid="bad-actors" /> }));
vi.mock('../components/drill-events', () => ({ DrillEvents: () => null }));
vi.mock('../hooks/use-drill-selection', () => ({ useDrillSelection: () => ({ selection: null, choose: () => undefined }) }));

const { DowntimeCausesPage } = await import('./causes-page');
const props = { filters: { unitIds: ['u-1'] }, bundle: {}, onChange: () => undefined } as unknown as DowntimePageProps;

function renderAt(url: string, declared: boolean) {
  mode.isDeclared = declared;
  render(<MemoryRouter initialEntries={[url]}><DowntimeCausesPage {...props} /></MemoryRouter>);
}

describe('causes page default analysis', () => {
  it('opens on downtime reasons in a declared plant when the URL has no analysis', () => {
    renderAt('/downtime/causes', true);
    expect(screen.getByTestId('reason-pareto')).toBeInTheDocument();
    expect(screen.queryByTestId('lost-production')).toBeNull();
  });

  it('keeps lost production as the default in a computed plant', () => {
    renderAt('/downtime/causes', false);
    expect(screen.getByTestId('lost-production')).toBeInTheDocument();
  });

  it('honours an explicit choice in a declared plant', () => {
    renderAt('/downtime/causes?analysis=lost-production', true);
    expect(screen.getByTestId('lost-production')).toBeInTheDocument();
  });
});
