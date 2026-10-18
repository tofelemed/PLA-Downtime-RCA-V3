import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { capabilitiesOf } from '@/features/auth/capabilities';

const passThrough = ({ children }: { children: ReactNode }) => <>{children}</>;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'u-shell' } } }) }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => capabilitiesOf(['manager_approver', 'Manager']) }));
vi.mock('@/api/v2/queries/feature-flags', () => ({ useFeatureFlags: () => ({ data: { items: [] } }) }));
vi.mock('@/app/routes', () => ({ preloadRoute: vi.fn() }));
vi.mock('@/features/shell/use-branding', () => ({ useBranding: () => undefined }));
vi.mock('@/features/plant-selector/plant-selector', () => ({ PlantSelector: () => <span>Plant</span> }));
vi.mock('@/features/display-currency/display-currency-toggle', () => ({ DisplayCurrencyToggle: () => null }));
vi.mock('@/features/notifications/notification-bell', () => ({ NotificationBell: () => null }));
vi.mock('@/features/shell/user-badge', () => ({ UserBadge: () => null }));
vi.mock('@/features/shell/live-indicator', () => ({ LiveIndicator: () => null }));
vi.mock('@/features/v2-foundation/plant-access-guard', () => ({ PlantAccessGuard: passThrough }));
vi.mock('@/features/equipment-setup/equipment-setup-provider', () => ({ EquipmentSetupProvider: passThrough }));
vi.mock('@/features/equipment-setup/setup-journey-bar', () => ({ SetupJourneyBar: () => null }));

const { Layout } = await import('@/components/Layout');

/** `matchMedia` answering `(min-width: Npx)` for a window `width` px wide; `resize` re-answers and notifies. */
function mockViewport(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return {
      get matches() {
        return width >= min;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
  });
  return (next: number) => {
    width = next;
    act(() => listeners.forEach((listener) => listener()));
  };
}

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <TooltipProvider>
        <Routes>
          <Route path="*" element={<Layout><p>Page content</p></Layout>} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('responsive shell (UX audit H-1)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('below 1024 px: no sidebar; the header button opens the menu drawer and following a link closes it', async () => {
    mockViewport(800);
    renderShell();
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).toBeNull();
    const button = screen.getByRole('button', { name: 'Open navigation' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const nav = within(drawer).getByRole('navigation', { name: 'Main menu' });
    // always expanded in the drawer, without the rail toggle
    expect(within(nav).queryByRole('button', { name: /sidebar/ })).toBeNull();
    await userEvent.click(within(nav).getByRole('link', { name: 'Month Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('1024–1279 px: the icon rail by default even when the saved preference is expanded; expanding there is for the visit', async () => {
    window.localStorage.setItem('proact.nav.u-shell', JSON.stringify({ collapsed: false, closedSections: [] }));
    mockViewport(1100);
    renderShell();
    expect(screen.queryByRole('button', { name: 'Open navigation' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(nav).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('proact.nav.u-shell') ?? '{}')).toMatchObject({ collapsed: false });
  });

  it('from 1280 px the saved preference applies; shrinking below 1024 px swaps the sidebar for the drawer button', () => {
    window.localStorage.setItem('proact.nav.u-shell', JSON.stringify({ collapsed: false, closedSections: [] }));
    const resize = mockViewport(1400);
    renderShell();
    expect(within(screen.getByRole('navigation', { name: 'Main menu' })).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    resize(900);
    expect(screen.queryByRole('navigation', { name: 'Main menu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });
});
