import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CrumbReachProvider } from './crumb-reach';
import { PageHeader } from './page-header';
import { dedupeCrumbs, isSetupPath, routeTrail } from './route-trail';
import { returnTargetOf, withReturnTo } from './return-to';

describe('routeTrail', () => {
  it('module pages (depth 1) and paths outside the menu get no trail', () => {
    expect(routeTrail('/events', 'Event Hub', undefined)).toBeNull();
    expect(routeTrail('/dev/ux-kit', 'Playground', undefined)).toBeNull();
  });

  it('Module › parent › page: the parent is the back link inside the module', () => {
    expect(routeTrail('/plans/p1/periods/x1', 'Period 3 Oct', { to: '/plans/p1', label: 'HDPE plan' })).toEqual({
      crumbs: [{ label: 'Plans', to: '/planning' }, { label: 'HDPE plan', to: '/plans/p1' }, { label: 'Period 3 Oct' }],
      keepBack: false,
    });
  });

  it('a back link to the module page itself is one crumb in the page\'s own words (keeps its tab)', () => {
    // since 21 Oct 2026 Codes & rules is the Setup entry "Codes & failures": its name, then the tab
    expect(routeTrail('/master-data/codes-rules/rules/r1', 'Rule', { to: '/master-data/codes-rules?tab=rules', label: 'Rules' })?.crumbs).toEqual([
      { label: 'Codes & failures', to: '/master-data/codes-rules' },
      { label: 'Rules', to: '/master-data/codes-rules?tab=rules' },
      { label: 'Rule' },
    ]);
    expect(routeTrail('/connectivity/connections/c1', 'Connection', { to: '/connectivity', label: 'Connections' })?.crumbs).toEqual([
      { label: 'Connections', to: '/connectivity' },
      { label: 'Connection' },
    ]);
    expect(routeTrail('/events/e1', 'Stop', { to: '/events?units=u1', label: 'Event Hub' })?.crumbs).toEqual([
      { label: 'Event Hub', to: '/events?units=u1' },
      { label: 'Stop' },
    ]);
  });

  it('a back link outside the module (where the user came from) stays next to the trail', () => {
    expect(routeTrail('/events/e1', 'Stop', { to: '/downtime?from=x', label: 'Downtime analysis' })).toEqual({
      crumbs: [{ label: 'Event Hub', to: '/events' }, { label: 'Stop' }],
      keepBack: true,
    });
  });

  it('the module named again in another case is one step (QA_SHELL: "Admin Panel › Admin panel › Edit Marun")', () => {
    expect(routeTrail('/admin/organizations/o1/edit', 'Edit Marun', { to: '/admin?tab=plants', label: 'ADMIN PANEL' })?.crumbs).toEqual([
      { label: 'ADMIN PANEL', to: '/admin?tab=plants' },
      { label: 'Edit Marun' },
    ]);
    expect(dedupeCrumbs([{ label: 'Tasks', to: '/tasks' }, { label: 'tasks', to: '/tasks?x=1' }, { label: 'T1', to: '/tasks?x=1' }, { label: 'Page' }])).toEqual([
      { label: 'T1', to: '/tasks?x=1' },
      { label: 'Page' },
    ]);
  });

  // SETUP_UX_FIXES Phase 3: a Setup area's first page has its area crumb like its sibling tabs
  it('the first page of a Setup area gets Area › page; a page named like its area gets none', () => {
    expect(routeTrail('/master-data/units', 'Production units', undefined)?.crumbs).toEqual([{ label: 'Plant & equipment', to: '/master-data/units' }, { label: 'Production units' }]);
    expect(routeTrail('/master-data/assets', 'Assets', undefined)?.crumbs).toEqual([{ label: 'Plant & equipment', to: '/master-data/units' }, { label: 'Assets' }]);
    expect(routeTrail('/master-data/stop-policy', 'Stop and plan policy', undefined)?.crumbs[0]).toEqual({ label: 'Production rules', to: '/master-data/stop-policy' });
    expect(routeTrail('/setup/profiles', 'Profiles & rates', undefined)).toBeNull();
    expect(routeTrail('/finance', 'Valuation', undefined)).toBeNull();
  });

  // SETUP_UX_FIXES Phase 5: a sidebar entry whose first page has another name reads Area › page
  it('every Setup area whose first page is named otherwise shows Area › page', () => {
    const trail = (path: string, title: string) => routeTrail(path, title, undefined)?.crumbs.map((crumb) => crumb.label).join(' › ');
    expect(trail('/master-data/stop-policy', 'Stop and plan policy')).toBe('Production rules › Stop and plan policy');
    expect(trail('/master-data/codes-rules', 'Codes & rules')).toBe('Codes & failures › Codes & rules');
    expect(trail('/master-data/rca/templates', 'RCA templates')).toBe('RCA library › RCA templates');
    expect(trail('/master-data/unit-impact-rules', 'Unit impact rules')).toBe('Production rules › Unit impact rules');
  });

  it('a Setup record page keeps the area crumb when its list is the first page of the area', () => {
    expect(routeTrail('/master-data/units/u1', 'Line 1', { to: '/master-data/units', label: 'Production units' })?.crumbs).toEqual([
      { label: 'Plant & equipment' },
      { label: 'Production units', to: '/master-data/units' },
      { label: 'Line 1' },
    ]);
    expect(isSetupPath('/planning/profiles/p1')).toBe(true);
    expect(isSetupPath('/events/e1')).toBe(false);
  });

  it('without a back link: Module › page', () => {
    expect(routeTrail('/tasks/t1', 'Replace seal', undefined)?.crumbs).toEqual([{ label: 'Tasks', to: '/tasks' }, { label: 'Replace seal' }]);
  });
});

describe('PageHeader breadcrumbs', () => {
  const at = (path: string, header: JSX.Element) => render(<MemoryRouter initialEntries={[path]}>{header}</MemoryRouter>);

  it('a sub-page gets the automatic trail instead of the plain back link', () => {
    at('/finance/policies/p1', <PageHeader title="Valuation policy version 2" back={{ to: '/finance?tab=policies', label: 'Valuation policies' }} />);
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('link', { name: 'Valuation' })).toHaveAttribute('href', '/finance');
    expect(within(trail).getByRole('link', { name: 'Valuation policies' })).toHaveAttribute('href', '/finance?tab=policies');
    expect(within(trail).getByText('Valuation policy version 2')).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Valuation policies' })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Valuation policy version 2' })).toBeInTheDocument();
  });

  it('a module page keeps its plain back link and no trail', () => {
    at('/planning', <PageHeader title="Planning" back={{ to: '/dashboard', label: 'Dashboard' }} />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('an explicit trail wins; false turns the automatic one off', () => {
    const { unmount } = at('/rca/c1/analysis', <PageHeader title="Analysis" breadcrumbs={[{ label: 'RCA', to: '/rca' }, { label: 'Seal leak', to: '/rca/c1' }, { label: 'Analysis' }]} />);
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getAllByRole('link').map((link) => link.textContent)).toEqual(['RCA', 'Seal leak']);
    unmount();
    at('/tasks/t1', <PageHeader title="Task" back={{ to: '/tasks', label: 'Tasks' }} breadcrumbs={false} />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('a step the user cannot open is plain text, and such a back link is left out (QA_MASTERDATA L23)', () => {
    const noConnectivity = (to: string) => !to.startsWith('/connectivity');
    const { unmount } = render(
      <MemoryRouter initialEntries={['/connectivity/connections/c1']}>
        <CrumbReachProvider reach={noConnectivity}><PageHeader title="Connection" back={{ to: '/connectivity?tab=x', label: 'Connections' }} /></CrumbReachProvider>
      </MemoryRouter>,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).queryAllByRole('link')).toHaveLength(0);
    expect(within(trail).getByText('Connections')).toBeInTheDocument();
    unmount();
    render(
      <MemoryRouter initialEntries={['/connectivity/source-authority']}>
        <CrumbReachProvider reach={noConnectivity}><PageHeader title="Source priority" back={{ to: '/connectivity', label: 'Connectivity' }} /></CrumbReachProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Connectivity' })).toBeNull();
  });

  it('a Setup sub-page shows a visible "Back to <list>" button next to its trail; other pages do not', () => {
    const { unmount } = at('/finance/fx/f1', <PageHeader title="USD → IRR" back={{ to: '/finance?tab=fx', label: 'Exchange rates' }} />);
    expect(screen.getByRole('link', { name: 'Back to Exchange rates' })).toHaveAttribute('href', '/finance?tab=fx');
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Valuation' })).toHaveAttribute('href', '/finance');
    unmount();
    at('/tasks/t1', <PageHeader title="Task" back={{ to: '/tasks', label: 'Tasks' }} />);
    expect(screen.queryByTestId('page-back')).toBeNull();
  });

  it('the Back button also stands beside an explicit trail', () => {
    at('/finance/policies/p1', <PageHeader title="Version 2" back={{ to: '/finance?tab=policies', label: 'Valuation policy' }} breadcrumbs={[{ label: 'Valuation', to: '/finance' }, { label: 'Version 2' }]} />);
    expect(screen.getByTestId('page-back')).toHaveTextContent('Back to Valuation policy');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('outside a router (isolated component tests) the header still renders', () => {
    render(<PageHeader title="Isolated" back={{ to: '/x', label: 'X' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Isolated' })).toBeInTheDocument();
  });
});

describe('return-to addresses', () => {
  it('a sub-page link carries the list address; only in-app addresses under the allowed lists are used', () => {
    const link = withReturnTo('/planning/profiles/p1', '/setup/profiles?unitId=u1&productId=x');
    expect(returnTargetOf(link.split('?')[1], ['/setup/profiles'])).toBe('/setup/profiles?unitId=u1&productId=x');
    expect(withReturnTo('/master-data/assets/new?unitId=u1', '/master-data/units/u1')).toBe('/master-data/assets/new?unitId=u1&back=%2Fmaster-data%2Funits%2Fu1');
    expect(returnTargetOf('?back=%2F%2Fevil.example', ['/setup/profiles'])).toBeNull();
    expect(returnTargetOf('?back=https%3A%2F%2Fevil.example', ['/setup/profiles'])).toBeNull();
    expect(returnTargetOf('?back=%2Fadmin', ['/setup/profiles'])).toBeNull();
    expect(returnTargetOf('', ['/setup/profiles'])).toBeNull();
  });
});
