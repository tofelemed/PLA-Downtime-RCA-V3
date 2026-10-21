import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { capabilitiesOf, type Capabilities } from '@/features/auth/capabilities';
import { NAVIGATION_ITEMS } from '@/features/auth/navigation-items';
import { RouteCapabilityGate } from './route-capability-gate';
import { INTEGRATION_ROUTES } from './integration';
import { canReachPath, routeOfPath, withMenuGates } from './route-gates';

let capabilities: Capabilities = capabilitiesOf([]);
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => capabilities }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));

const route = (path: string) => ({ path, element: null });

describe('withMenuGates', () => {
  it('a route needs the capability of the menu item its path belongs to (longest match)', () => {
    const gated = withMenuGates([route('/finance/policies/:policyId'), route('/plans/:planId/periods/:periodId/*'), route('/connectivity/source-status'), route('/month-close'), route('/period-accounting')]);
    expect(gated.map((r) => [r.requires, r.gateTitle])).toEqual([
      ['canViewAnalysis', 'Valuation'],
      ['canViewAnalysis', 'Plans'],
      ['canReachIntegration', 'Source status rules'],
      ['canViewAnalysis', 'Month close'],
      ['canViewAnalysis', 'Period accounting'],
    ]);
  });

  it('paths outside the menu stay open; an explicit requires is kept', () => {
    const [redirect, own] = withMenuGates([route('/production-plans'), { ...route('/admin'), requires: 'isSuperAdmin' as const }]);
    expect(redirect.requires).toBeUndefined();
    expect(own.requires).toBe('isSuperAdmin');
  });

  it('every menu item is reachable: its own route needs exactly the capability that lists it', () => {
    const gated = withMenuGates(NAVIGATION_ITEMS.map((item) => route(item.href)));
    expect(gated.map((r) => r.requires)).toEqual(NAVIGATION_ITEMS.map((item) => item.capability));
  });
});

describe('canReachPath (breadcrumb targets, QA_MASTERDATA L23)', () => {
  const routes = withMenuGates(INTEGRATION_ROUTES);
  it('a production accountant reaches Source priority but not the Connectivity console it sits under', () => {
    const accountant = capabilitiesOf(['production_accountant']);
    expect(canReachPath('/connectivity', accountant, routes)).toBe(false);
    expect(canReachPath('/connectivity/source-authority?unitId=u1', accountant, routes)).toBe(true);
    expect(canReachPath('/somewhere-else', accountant, routes)).toBe(true);
    expect(canReachPath('/connectivity#jobs', capabilitiesOf(['SuperAdmin']), routes)).toBe(true);
  });
  it('a static segment wins over a parameter', () => {
    expect(routeOfPath('/connectivity/connections/new', routes)?.path).toBe('/connectivity/connections/new');
  });
});

describe('Integration routes (owner 18 Oct 2026: SuperAdmin only)', () => {
  it('every page is SuperAdmin-only except the two maker-checker review pages', () => {
    const gates = Object.fromEntries(withMenuGates(INTEGRATION_ROUTES).map((r) => [r.path, r.requires]));
    expect(gates['/connectivity']).toBe('canReachIntegration');
    expect(gates['/connectivity/connections/:connectionId']).toBe('canReachIntegration');
    expect(gates['/enhanced-historian']).toBe('canReachIntegration');
    expect(gates['/connectivity/source-authority']).toBe('canReviewSourcePriority');
    expect(gates['/connectivity/source-status']).toBe('canReviewSourceStatusRules');
  });

  it('an integration administrator gets the denied page; SuperAdmin and the production accountant (review page) get through', () => {
    const at = (path: string) =>
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/connectivity" element={<RouteCapabilityGate requires="canReachIntegration" title="Connectivity"><p>Console</p></RouteCapabilityGate>} />
            <Route path="/connectivity/source-authority" element={<RouteCapabilityGate requires="canReviewSourcePriority" title="Source priority"><p>Priority</p></RouteCapabilityGate>} />
          </Routes>
        </MemoryRouter>,
      );
    capabilities = capabilitiesOf(['integration_admin']);
    const first = at('/connectivity');
    expect(screen.queryByText('Console')).toBeNull();
    first.unmount();
    capabilities = capabilitiesOf(['SuperAdmin']);
    const second = at('/connectivity');
    expect(screen.getByText('Console')).toBeInTheDocument();
    second.unmount();
    capabilities = capabilitiesOf(['production_accountant']);
    at('/connectivity/source-authority');
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });
});

describe('RouteCapabilityGate', () => {
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/finance" element={<RouteCapabilityGate requires="canViewAnalysis" title="Finance"><p>Finance page</p></RouteCapabilityGate>} />
          <Route path="/open" element={<RouteCapabilityGate><p>Open page</p></RouteCapabilityGate>} />
        </Routes>
      </MemoryRouter>,
    );

  it('a typed URL without the capability shows one denied page, not the page', () => {
    capabilities = capabilitiesOf(['operator']);
    at('/finance');
    expect(screen.queryByText('Finance page')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Finance' })).toBeInTheDocument();
    expect(screen.getByText(/do not include Finance/)).toBeInTheDocument();
  });

  it('with the capability (or with none required) the page renders', () => {
    capabilities = capabilitiesOf(['production_engineer']);
    const { unmount } = at('/finance');
    expect(screen.getByText('Finance page')).toBeInTheDocument();
    unmount();
    capabilities = capabilitiesOf([]);
    at('/open');
    expect(screen.getByText('Open page')).toBeInTheDocument();
  });
});
