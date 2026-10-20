import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ApprovalActionView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { monthCloseFixture } from '@/features/month-close/month-close-test-fixtures';
import { SelfDecisionBadge } from './self-decision-badge';

const actions = vi.hoisted(() => ({ items: [] as ApprovalActionView[] }));
vi.mock('@/api/v2/queries/period-overview', () => ({
  useApprovalActions: () => ({ data: { items: actions.items }, isLoading: false, isError: false, error: null }),
}));
vi.mock('@/features/auth/use-current-user-id', () => ({ useCurrentUserId: () => 'someone-else' }));
vi.mock('@/features/ux-kit/labels', async (original) => ({
  ...(await original<typeof import('@/features/ux-kit/labels')>()),
  useUserNames: () => ({ nameOf: (id: string | null | undefined) => (id ? `User ${id}` : 'Unknown') }),
}));
vi.mock('@/features/plan-dashboard/workflow/change-proposals-panel', () => ({ ChangeProposalsPanel: () => null }));
vi.mock('@/features/plan-dashboard/workflow/export-panel', () => ({ ExportPanel: () => null }));

const { PeriodHistory } = await import('@/features/plan-dashboard/workflow/period-history');
const { CloseHistory } = await import('@/features/month-close/components/close-history');

function action(id: string, name: string, selfDecided: boolean): ApprovalActionView {
  return {
    id, revisionId: 'rev1', action: name, fromLifecycle: 'in_review', toLifecycle: 'approved', actorId: 'sa', service: null,
    reason: null, submittedHash: 'hash', correlationId: null, selfDecided, at: '2026-10-08T14:00:00.000Z',
  };
}

describe('SelfDecisionBadge (item 1.3)', () => {
  it('shows the words in the warning tone with an explanation for assistive technology', () => {
    render(<SelfDecisionBadge selfDecided />);
    const badge = screen.getByTestId('self-decision-badge');
    expect(badge).toHaveTextContent('Self-approved (SuperAdmin)');
    expect(badge).toHaveAttribute('data-tone', 'warning');
    expect(badge).toHaveTextContent(/separation of duties was waived/i);
  });

  it('says "decided" for other decisions and shows nothing without the server flag', () => {
    const { rerender } = render(<SelfDecisionBadge selfDecided kind="decided" />);
    expect(screen.getByTestId('self-decision-badge')).toHaveTextContent('Self-decided (SuperAdmin)');
    rerender(<SelfDecisionBadge selfDecided={false} />);
    expect(screen.queryByTestId('self-decision-badge')).toBeNull();
    rerender(<SelfDecisionBadge selfDecided={undefined} />);
    expect(screen.queryByTestId('self-decision-badge')).toBeNull();
  });
});

describe('self-decisions in workflow histories (item 1.3)', () => {
  it('period revision history marks only the self-approved action', () => {
    actions.items = [action('a2', 'approve', true), action('a1', 'submit', false)];
    const view = { periodId: 'period1', revision: { lifecycle: 'in_review' } } as unknown as ReconciliationView;
    render(<PeriodHistory view={view} timezone="UTC" />);
    const rows = within(screen.getByTestId('revision-history')).getAllByRole('row');
    const approve = rows.find((row) => row.querySelector('[data-action="approve"]'));
    expect(approve && within(approve).getByTestId('self-decision-badge')).toHaveTextContent('Self-approved (SuperAdmin)');
    expect(screen.getAllByTestId('self-decision-badge')).toHaveLength(1);
  });

  it('month-close history marks a self-decided sign-off', () => {
    const view = monthCloseFixture();
    view.history = [
      { id: 'h2', action: 'sign_off_finance', fromState: 'quantities_closed', toState: 'finance_signed_off', actor: { id: 'sa', name: 'Super Admin' },
        reason: null, detail: {}, selfDecided: true, createdAt: '2026-10-25T09:00:00Z' },
      { id: 'h1', action: 'close_quantities', fromState: 'open', toState: 'quantities_closed', actor: { id: 'sa', name: 'Super Admin' },
        reason: null, detail: {}, selfDecided: false, createdAt: '2026-10-25T08:00:00Z' },
    ];
    render(<CloseHistory view={view} />);
    const [signOff, close] = within(screen.getByTestId('close-history')).getAllByRole('listitem');
    expect(within(signOff).getByTestId('self-decision-badge')).toHaveTextContent('Self-decided (SuperAdmin)');
    expect(within(close).queryByTestId('self-decision-badge')).toBeNull();
  });
});
