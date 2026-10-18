import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { EquipmentSetupProvider } from './equipment-setup-provider';
import { EquipmentSetupPage } from './equipment-setup-page';
import { SetupJourneyBar } from './setup-journey-bar';
import { journeyKey, readJourney, storeJourney } from './journey-storage';
import { SETUP_PHASES, SETUP_STEPS } from './setup-steps';

vi.mock('./equipment-readiness', () => ({ EquipmentReadiness: ({ children }: { children: ReactNode }) => <>{children}</> }));
const plant = vi.hoisted(() => ({ id: 'tenant-a' }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: { tenant: { id: plant.id } } }) }));
vi.mock('@/features/master-data/components/unit-select', () => ({ UnitSelect: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => <label htmlFor={id}>{label}<select id={id} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Choose a unit</option><option value="unit-a">Extruder A</option><option value="unit-b">Extruder B</option></select></label> }));
const connectionId = '10000000-0000-4000-8000-000000000001';
const planId = '10000000-0000-4000-8000-000000000002';
const periodId = '10000000-0000-4000-8000-000000000003';
function Pages() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}</output><SetupJourneyBar />
    {location.pathname === '/equipment-setup' ? <EquipmentSetupPage /> : <p>Actual form page</p>}
    <button onClick={() => navigate(`/connectivity/connections/${connectionId}`)}>Open saved connection</button>
    <button onClick={() => navigate(`/plans/${planId}/periods/${periodId}`)}>Open saved period</button>
  </>;
}
const show = (path = '/equipment-setup') => render(<MemoryRouter initialEntries={[path]}><EquipmentSetupProvider><Pages /></EquipmentSetupProvider></MemoryRouter>);
const open = (title: string) => {
  const row = screen.getByRole('heading', { name: new RegExp(title), hidden: true }).closest('li')!;
  const phase = row.closest('details')!;
  if (!phase.open) fireEvent.click(phase.querySelector('summary')!);
  fireEvent.click(within(row).getByRole('button'));
};
beforeEach(() => { sessionStorage.clear(); actAs('SuperAdmin'); plant.id = 'tenant-a'; vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); actAs('SuperAdmin'); });

describe('ordered equipment setup navigation', () => {
  it('covers every setup stage in order without asserting completion or writing records', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 3, hidden: true })).toHaveLength(19);
    expect(document.querySelectorAll('details')).toHaveLength(6);
    expect(document.querySelectorAll('details[open]')).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Master data sections' })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(SETUP_STEPS.map((step) => step.id)).toEqual(['plant', 'unit', 'assets', 'products', 'codes', 'stop-policy', 'impact', 'calendar', 'profiles', 'connection', 'signals', 'state', 'authority', 'finance', 'telemetry', 'plan', 'events', 'period', 'analysis']);
    open('Plant and display settings');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?tab=plants');
    fireEvent.click(screen.getByRole('button', { name: 'Next setup step' }));
    expect(screen.getByRole('button', { name: 'Next setup step' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Setup production unit'), { target: { value: 'unit-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next setup step' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/master-data/assets');
    fireEvent.click(screen.getByRole('button', { name: 'Previous setup step' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/master-data/units/unit-a');
    expect(screen.getByText(/Guide navigation does not save changes/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('discloses the chosen phase, resumes it and keeps policy before planning', () => {
    show();
    fireEvent.click(screen.getByLabelText('Phase 2: Define production rules'));
    fireEvent.change(screen.getByLabelText('Existing production unit (optional)'), { target: { value: 'unit-a' } });
    open('Codes and rules');
    expect(screen.getByRole('complementary')).toHaveTextContent('Define production rules');
    fireEvent.click(screen.getByRole('button', { name: 'Next setup step' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/master-data/stop-policy?unitId=unit-a');
    fireEvent.click(screen.getByRole('link', { name: 'All setup steps' }));
    expect(screen.getByLabelText('Phase 2: Define production rules').closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Continue: Stop-engine and plan policy' })).toBeEnabled();
    const position = (id: string) => SETUP_STEPS.findIndex((step) => step.id === id);
    expect(position('codes')).toBeGreaterThan(position('products'));
    expect(position('codes')).toBeLessThan(position('stop-policy'));
    expect(position('stop-policy')).toBeLessThan(position('plan'));
    expect(SETUP_PHASES.flatMap((phase) => SETUP_STEPS.filter((step) => step.phase === phase.id))).toEqual(SETUP_STEPS);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('remembers a saved connection, carries unit into Signals, and resumes through a reload', async () => {
    storeJourney(journeyKey('tenant-a', 'user-1'), { stepId: 'connection', unitId: 'unit-a', connectionId: '', planId: '', periodId: '' });
    const view = show('/connectivity');
    fireEvent.click(screen.getByRole('button', { name: 'Open saved connection' }));
    await waitFor(() => expect(readJourney(journeyKey('tenant-a', 'user-1'))?.connectionId).toBe(connectionId));
    fireEvent.click(screen.getByRole('button', { name: 'Next setup step' }));
    expect(screen.getByTestId('location')).toHaveTextContent(`/connectivity/connections/${connectionId}?tab=signals&unitId=unit-a`);
    view.unmount(); show('/equipment-setup');
    expect(screen.getByRole('complementary', { name: 'Equipment setup navigation' })).toHaveTextContent('State and output signals');
    expect(screen.getByLabelText('Setup production unit')).toHaveValue('unit-a');
  });
  it('remembers the actual period URL and clears it when selecting another unit', async () => {
    storeJourney(journeyKey('tenant-a', 'user-1'), { stepId: 'period', unitId: 'unit-a', connectionId, planId: '', periodId: '' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Open saved period' }));
    await waitFor(() => expect(readJourney(journeyKey('tenant-a', 'user-1'))?.periodId).toBe(periodId));
    fireEvent.click(screen.getByRole('button', { name: 'Open this step' }));
    expect(screen.getByTestId('location')).toHaveTextContent(`/plans/${planId}/periods/${periodId}`);
    fireEvent.change(screen.getByLabelText('Setup production unit'), { target: { value: 'unit-b' } });
    expect(readJourney(journeyKey('tenant-a', 'user-1'))).toMatchObject({ unitId: 'unit-b', planId: '', periodId: '' });
  });
  it('isolates browser resume by user and plant; Exit guide clears only navigation', () => {
    storeJourney(journeyKey('tenant-a', 'user-1'), { stepId: 'unit', unitId: 'unit-a', connectionId: '', planId: '', periodId: '' });
    const first = show(); fireEvent.click(screen.getByRole('button', { name: 'Exit guide' }));
    expect(readJourney(journeyKey('tenant-a', 'user-1'))).toBeNull(); first.unmount();
    storeJourney(journeyKey('tenant-a', 'user-1'), { stepId: 'unit', unitId: 'unit-a', connectionId: '', planId: '', periodId: '' });
    actAs('SuperAdmin', 'user-2'); const second = show();
    expect(screen.queryByRole('complementary', { name: 'Equipment setup navigation' })).toBeNull(); second.unmount();
    actAs('SuperAdmin'); plant.id = 'tenant-b'; show();
    expect(screen.queryByRole('complementary', { name: 'Equipment setup navigation' })).toBeNull();
    expect(readJourney(journeyKey('tenant-a', 'user-1'))?.unitId).toBe('unit-a');
  });
  it('retains role boundaries and rejects malformed resume state', () => {
    actAs('viewer'); show(); fireEvent.change(screen.getByLabelText('Existing production unit (optional)'), { target: { value: 'unit-a' } }); open('Codes and rules');
    expect(screen.getByTestId('location')).toHaveTextContent('/master-data/codes-rules');
    // A viewer cannot access unit administration even by navigating through the guide.
    fireEvent.click(screen.getByRole('link', { name: 'All setup steps' }));
    const unit = screen.getByRole('heading', { name: /Production unit/, hidden: true }).closest('li')!;
    const phase = unit.closest('details')!;
    if (!phase.open) fireEvent.click(phase.querySelector('summary')!);
    expect(within(unit).getByRole('button')).toBeDisabled();
    sessionStorage.setItem('invalid', '{"stepId":"https://example.test"}');
    expect(readJourney('invalid')).toBeNull();
  });
});
