import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const view = {
  appName: 'Traverse Forge',
  appSubtitle: 'Production loss accounting',
  logoInitials: 'TF',
  primaryColor: '#2563eb',
  secondaryColor: '#ec4899',
  logoSize: 32,
  isStored: true,
  updatedAt: null,
};
const submit = vi.fn(() => Promise.resolve(view));

vi.mock('@/api/v2/queries/administration-config', () => ({
  useBranding: () => ({ data: view, isLoading: false, error: null, refetch: vi.fn() }),
  useSaveBranding: () => ({ submit, isPending: false }),
  useResetBranding: () => ({ submit: vi.fn(), isPending: false }),
}));
vi.mock('../shared/use-command-feedback', () => ({
  useCommandFeedback: () => (run: () => Promise<unknown>) => run(),
}));

const { BrandingSection } = await import('./branding-section');

describe('branding form (settings audit, 21 Oct 2026)', () => {
  it('saves a cleared subtitle as empty instead of bringing the default back', () => {
    render(<BrandingSection />);
    fireEvent.change(screen.getByLabelText(/Subtitle/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ appSubtitle: '' }));
  });

  it('shows the server limits on the size fields', () => {
    render(<BrandingSection />);
    const size = screen.getByLabelText(/Logo size/);
    fireEvent.change(size, { target: { value: '4' } });
    expect(screen.getByText('Enter 8–256.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Frame background opacity/)).toHaveAttribute('max', '1');
  });
});
