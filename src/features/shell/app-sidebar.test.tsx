import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { useNavState } from '@/features/auth/use-nav-state';
import { AppSidebar } from './app-sidebar';

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => capabilitiesOf(['manager_approver', 'Manager']) }));
vi.mock('@/api/v2/queries/feature-flags', () => ({
  useFeatureFlags: () => ({ data: { items: [{ key: 'v2.downtimeAnalysis', enabled: true }, { key: 'v2.codesAdmin', enabled: true }] } }),
}));
vi.mock('@/app/routes', () => ({ preloadRoute: vi.fn() }));

function Harness() {
  const nav = useNavState('u-test');
  return <AppSidebar nav={nav} />;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Harness />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('AppSidebar', () => {
  it('keeps the analysis rail compact and opens every page in the expanded group with its scope', async () => {
    window.localStorage.clear();
    renderAt('/downtime/causes?units=u1&products=p1');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(nav).getByRole('link', { name: 'Causes & Pareto' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Downtime analysis' })).toBeNull();
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByRole('button', { name: 'Downtime analysis' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('link', { name: 'Stops & timeline' })).toHaveAttribute('href', '/downtime/stops?units=u1&products=p1');
    expect(within(nav).getByRole('link', { name: 'Downtime overview' })).not.toHaveAttribute('aria-current');
    // other sections start closed (accordion); their links keep the scope
    expect(within(nav).getByRole('link', { name: 'Loss valuation', hidden: true })).toHaveAttribute('href', '/pla-analytics/valuation?units=u1');
  });

  it('carries the shared analysis context (B-8) from the Event Hub to Downtime, PLA and Reports, not to other modules', async () => {
    window.localStorage.clear();
    renderAt('/events?window=24h&units=u1&kinds=downtime');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByRole('link', { name: 'Event Hub' })).toHaveAttribute('href', '/events?window=24h&units=u1&kinds=downtime');
    expect(within(nav).getByRole('link', { name: 'Downtime overview', hidden: true })).toHaveAttribute('href', '/downtime?window=24h&units=u1');
    expect(within(nav).getByRole('link', { name: 'PLA overview', hidden: true })).toHaveAttribute('href', '/pla-analytics?window=24h&units=u1');
    expect(within(nav).getByRole('link', { name: 'Reports', hidden: true })).toHaveAttribute('href', '/reports?window=24h&units=u1');
    expect(within(nav).getByRole('link', { name: 'My work' })).toHaveAttribute('href', '/my-queue');
    expect(within(nav).getByRole('link', { name: 'RCA Analysis', hidden: true })).toHaveAttribute('href', '/rca');
  });

  it('expanded (UX audit B-1): the two overviews are named apart, long labels wrap with the full name as title', async () => {
    window.localStorage.clear();
    renderAt('/planning/plans/p1');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByRole('link', { name: 'Downtime overview', hidden: true })).toHaveAttribute('href', '/downtime');
    expect(within(nav).getByRole('link', { name: 'PLA overview', hidden: true })).toHaveAttribute('href', '/pla-analytics');
    expect(within(nav).queryByRole('link', { name: 'Overview', hidden: true })).toBeNull();
    // label in name (WCAG 2.5.3): a short label keeps the fuller name
    expect(within(nav).getByRole('link', { name: 'PLA trends', hidden: true })).toHaveTextContent('Trends');
    const plans = within(nav).getByRole('link', { name: 'Plans' });
    expect(plans).toHaveAttribute('aria-current', 'page');
    expect(plans).toHaveAttribute('title', 'Plans');
    expect(plans.querySelector('span')).toHaveClass('line-clamp-2');
    expect(plans.querySelector('span')).not.toHaveClass('truncate');
  });

  it('PLA lists "Period accounting" (UX audit B-5), a plain link resolved by its own route', async () => {
    window.localStorage.clear();
    renderAt('/pla-analytics/oee?units=u1');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    const pla = within(nav).getByRole('button', { name: 'Production loss analysis (PLA)' });
    const list = document.getElementById(pla.getAttribute('aria-controls') ?? '');
    expect(within(list as HTMLElement).getByRole('link', { name: 'Period accounting' })).toHaveAttribute('href', '/period-accounting');
  });

  it('collapsed rail: every link has an accessible name, the toggle is "Expand sidebar"', () => {
    window.localStorage.clear();
    renderAt('/rca-knowledge-base');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(nav).getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Knowledge base' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'RCA Analysis' })).not.toHaveAttribute('aria-current');
    expect(within(nav).queryByRole('link', { name: 'Connectivity' })).toBeNull();
  });

  it('expanded: sections are disclosures; a closed section keeps its links in the DOM', async () => {
    window.localStorage.clear();
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    const reliability = within(nav).getByRole('button', { name: 'Reliability' });
    expect(reliability).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(reliability);
    expect(reliability).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
    await userEvent.click(reliability);
    expect(reliability).toHaveAttribute('aria-expanded', 'false');
    expect(nav.querySelector('a[href="/tasks"]')).not.toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Tasks' })).toBeNull();
  });

  it('the section holding the current page can be closed and opened again by hand', async () => {
    window.localStorage.clear();
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    const overview = within(nav).getByRole('button', { name: 'Overview' });
    expect(overview).toBeEnabled();
    expect(overview).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(overview);
    expect(overview).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(overview.getAttribute('aria-controls') ?? '')).not.toBeVisible();
    await userEvent.click(overview);
    expect(overview).toHaveAttribute('aria-expanded', 'true');
  });

  it('accordion: on first load only the current section is open; moving to another section opens it and closes the previous', async () => {
    window.localStorage.clear();
    renderAt('/pla-analytics/oee');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    const section = (name: string) => within(nav).getByRole('button', { name });
    expect(section('Production loss analysis (PLA)')).toHaveAttribute('aria-expanded', 'true');
    expect(section('Downtime analysis')).toHaveAttribute('aria-expanded', 'false');
    // a section opened by hand stays open until the current section changes
    await userEvent.click(section('Downtime analysis'));
    expect(section('Downtime analysis')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(within(nav).getByRole('link', { name: 'Stops & timeline' }));
    expect(section('Downtime analysis')).toHaveAttribute('aria-expanded', 'true');
    expect(section('Production loss analysis (PLA)')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(section('Overview'));
    await userEvent.click(within(nav).getByRole('link', { name: 'Dashboard' }));
    expect(section('Overview')).toHaveAttribute('aria-expanded', 'true');
    expect(section('Downtime analysis')).toHaveAttribute('aria-expanded', 'false');
  });

  it('sections are listed Overview, Production, PLA, Downtime, Reliability, ...', async () => {
    window.localStorage.clear();
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    const sections = within(nav).getAllByRole('button').filter((button) => button.hasAttribute('aria-controls')).map((button) => button.textContent);
    expect(sections.slice(0, 5)).toEqual(['Overview', 'Production', 'Production loss analysis (PLA)', 'Downtime analysis', 'Reliability']);
  });
});
