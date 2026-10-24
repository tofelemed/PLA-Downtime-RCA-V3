import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HeaderApprovals } from './header-approvals';

const state = vi.hoisted(() => ({ canReachApprovals: true, items: [] as unknown[], nextCursor: undefined as string | undefined }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canReachApprovals: state.canReachApprovals }) }));
vi.mock('@/api/v2/queries/approvals', () => ({
  useApprovalInbox: () => ({ query: { data: { pages: [{ items: state.items, nextCursor: state.nextCursor }] } } }),
}));

const renderButton = () =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <HeaderApprovals />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('HeaderApprovals', () => {
  beforeEach(() => Object.assign(state, { canReachApprovals: true, items: [{}, {}, {}], nextCursor: undefined }));

  it('links to /approvals and shows the pending count in the name and badge', () => {
    renderButton();
    const link = screen.getByRole('link', { name: 'Pending approvals, 3 pending' });
    expect(link).toHaveAttribute('href', '/approvals');
    expect(link).toHaveTextContent('3');
  });

  it('shows "N+" when the first page has more', () => {
    state.nextCursor = 'next';
    renderButton();
    expect(screen.getByRole('link', { name: /Pending approvals, 3\+ pending/ })).toHaveTextContent('3+');
  });

  it('hides the badge at 0', () => {
    state.items = [];
    renderButton();
    expect(screen.getByRole('link', { name: 'Pending approvals' })).not.toHaveTextContent(/\d/);
  });

  it('is hidden without the approvals capability', () => {
    state.canReachApprovals = false;
    renderButton();
    expect(screen.queryByRole('link', { name: /Pending approvals/ })).toBeNull();
  });
});
