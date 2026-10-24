import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { BrandingView } from '@/api/v2/types/administration';
import { AppHeader } from './app-header';

vi.mock('@/features/plant-selector/plant-selector', () => ({ PlantSelector: () => <span>Plant</span> }));
vi.mock('./plant-timezone-readout', () => ({ PlantTimezoneReadout: () => null }));
vi.mock('@/features/notifications/notification-bell', () => ({ NotificationBell: () => null }));
vi.mock('./user-badge', () => ({ UserBadge: () => null }));
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => null }));

const renderHeader = (branding?: BrandingView, navigation?: { open: boolean; onOpen: () => void }) =>
  render(
    <MemoryRouter>
      <AppHeader branding={branding} navigation={navigation} />
    </MemoryRouter>,
  );

describe('AppHeader brand', () => {
  it('links the brand to the Dashboard with the app name, before the plant selector', () => {
    renderHeader();
    const brand = screen.getByRole('link', { name: 'Traverse Forge — go to Dashboard' });
    expect(brand).toHaveAttribute('href', '/dashboard');
    expect(brand).toHaveTextContent('Traverse Forge');
    expect(brand.compareDocumentPosition(screen.getByText('Plant')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses the configured app name and hides the name below sm (mark only)', () => {
    renderHeader({ appName: 'Marun Forge' } as BrandingView);
    const brand = screen.getByRole('link', { name: 'Marun Forge — go to Dashboard' });
    expect(brand.querySelector('span.hidden')).toHaveClass('sm:block');
    expect(screen.getByTestId('brand-mark')).toBeInTheDocument();
  });

  it('puts the brand after the drawer menu button', () => {
    renderHeader(undefined, { open: false, onOpen: vi.fn() });
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    const brand = screen.getByRole('link', { name: /go to Dashboard/ });
    expect(menu.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
