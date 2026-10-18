import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';
import { routeTrail } from './route-trail';

describe('routeTrail', () => {
  it('module pages (depth 1) and paths outside the menu get no trail', () => {
    expect(routeTrail('/events', 'Event Hub', undefined)).toBeNull();
    expect(routeTrail('/dev/ux-kit', 'Playground', undefined)).toBeNull();
  });

  it('Module › parent › page: the parent is the back link inside the module', () => {
    expect(routeTrail('/plans/p1/periods/x1', 'Period 3 Oct', { to: '/plans/p1', label: 'HDPE plan' })).toEqual({
      crumbs: [{ label: 'Plans, Profiles & Calendars', to: '/planning' }, { label: 'HDPE plan', to: '/plans/p1' }, { label: 'Period 3 Oct' }],
      keepBack: false,
    });
  });

  it('a back link to the module page itself is one crumb in the page\'s own words (keeps its tab)', () => {
    expect(routeTrail('/master-data/codes-rules/rules/r1', 'Rule', { to: '/master-data/codes-rules?tab=rules', label: 'Rules' })?.crumbs).toEqual([
      { label: 'Master Data', to: '/master-data' },
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
    expect(routeTrail('/events/e1', 'Stop', { to: '/downtime?from=x', label: 'Downtime Analysis' })).toEqual({
      crumbs: [{ label: 'Event Hub', to: '/events' }, { label: 'Stop' }],
      keepBack: true,
    });
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
    expect(within(trail).getByRole('link', { name: 'Finance' })).toHaveAttribute('href', '/finance');
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

  it('outside a router (isolated component tests) the header still renders', () => {
    render(<PageHeader title="Isolated" back={{ to: '/x', label: 'X' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Isolated' })).toBeInTheDocument();
  });
});
