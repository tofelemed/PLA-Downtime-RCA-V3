import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { EquipmentSetupPage } from './equipment-setup-page';
import { SETUP_PHASES, SETUP_STEPS, setupStep } from './setup-steps';

vi.mock('./equipment-readiness', () => ({ EquipmentReadiness: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/features/master-data/components/unit-select', () => ({ UnitSelect: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => <label htmlFor={id}>{label}<select id={id} value={value} onChange={(e) => onChange(e.target.value)}><option value="">No unit selected</option><option value="unit-a">Extruder A</option></select></label> }));

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
const show = (path = '/equipment-setup') => render(<MemoryRouter initialEntries={[path]}><Location /><EquipmentSetupPage /></MemoryRouter>);
const stepRow = (id: string) => document.getElementById(`setup-step-${id}`)!.closest('li')!;
const goTo = (id: string) => within(stepRow(id)).getByRole('link', { name: `Go to ${setupStep(id).page}` });

beforeEach(() => { actAs('SuperAdmin'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); actAs('SuperAdmin'); });

describe('equipment setup guide page', () => {
  it('lists all six phases and nineteen steps in order, expanded, with no journey controls', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(SETUP_PHASES.map((phase, index) => `Phase ${index + 1}: ${phase.title}`));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(19);
    expect(document.querySelectorAll('details[open]')).toHaveLength(6);
    expect(SETUP_STEPS.map((step) => step.id)).toEqual(['plant', 'unit', 'assets', 'products', 'codes', 'stop-policy', 'impact', 'calendar', 'profiles', 'connection', 'signals', 'state', 'authority', 'finance', 'telemetry', 'plan', 'events', 'period', 'analysis']);
    expect(SETUP_PHASES.flatMap((phase) => SETUP_STEPS.filter((step) => step.phase === phase.id))).toEqual(SETUP_STEPS);
    expect(within(stepRow('impact')).getByText('Optional')).toBeInTheDocument();
    expect(screen.queryByText(/Exit guide|Next setup step|Start equipment setup/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('links every step straight to its page, with the related pages beside it', () => {
    show();
    for (const step of SETUP_STEPS) expect(goTo(step.id)).toHaveAttribute('href', step.to({ unitId: '' }));
    expect(goTo('plan')).toHaveAttribute('href', '/planning');
    expect(goTo('signals')).toHaveAttribute('href', '/connectivity');
    expect(within(stepRow('signals')).getByText(/Open the saved connection, then its Signals tab/)).toBeInTheDocument();
    expect(within(stepRow('analysis')).getByRole('link', { name: setupStep('analysis').related![0].label })).toHaveAttribute('href', '/pla-analytics');
    fireEvent.click(goTo('codes'));
    expect(screen.getByTestId('location')).toHaveTextContent('/master-data/codes-rules');
  });

  it('fills unit deep links from the chosen unit and keeps it in the URL', () => {
    show();
    expect(within(stepRow('stop-policy')).getByText('Select a unit above to open this unit directly.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Production unit (optional)'), { target: { value: 'unit-a' } });
    expect(screen.getByTestId('location')).toHaveTextContent('/equipment-setup?unitId=unit-a');
    expect(goTo('unit')).toHaveAttribute('href', '/master-data/units/unit-a');
    expect(goTo('stop-policy')).toHaveAttribute('href', '/master-data/stop-policy?unitId=unit-a');
    expect(goTo('state')).toHaveAttribute('href', '/master-data/unit-state?unitId=unit-a');
    expect(goTo('authority')).toHaveAttribute('href', '/connectivity/source-authority?unitId=unit-a');
    expect(screen.queryByText('Select a unit above to open this unit directly.')).toBeNull();
  });

  it('reads a shared unit from the URL', () => {
    show('/equipment-setup?unitId=unit-a');
    expect(screen.getByLabelText('Production unit (optional)')).toHaveValue('unit-a');
    expect(goTo('impact')).toHaveAttribute('href', '/master-data/unit-impact-rules?unitId=unit-a');
  });

  it('collapses and expands every phase', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(document.querySelectorAll('details[open]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(document.querySelectorAll('details[open]')).toHaveLength(6);
  });

  it('disables a step the role cannot open and explains why', () => {
    actAs('viewer'); show();
    expect(within(stepRow('unit')).queryByRole('link')).toBeNull();
    expect(within(stepRow('unit')).getByRole('button', { name: `Go to ${setupStep('unit').page}` })).toBeDisabled();
    expect(within(stepRow('unit')).getByText(/Your role cannot open this page/)).toBeInTheDocument();
    expect(goTo('codes')).toHaveAttribute('href', '/master-data/codes-rules');
  });

  it('no longer puts a setup bar on the other pages', () => {
    const layout = readFileSync(join(__dirname, '../../components/Layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/SetupJourneyBar|EquipmentSetupProvider/);
  });
});
