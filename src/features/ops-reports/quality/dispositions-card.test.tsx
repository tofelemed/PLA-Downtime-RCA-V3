import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { QualityDispositionsView } from '@/api/v2/types/ops-reports';

const view: QualityDispositionsView = {
  groups: [
    { dispositionClass: 'downgrade', state: 'approved', productId: 'p1', productCode: 'HD5218', uom: 't', lots: 2, quantity: '12.5' },
    { dispositionClass: 'scrap', state: 'proposed', productId: 'p1', productCode: 'HD5218', uom: 't', lots: 1, quantity: '3' },
  ],
  pending: 1,
  oldestPendingAt: '2027-03-01T04:00:00.000Z',
};

vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'Asia/Tehran' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useQualityDispositions: () => ({ data: view, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { DispositionsCard } = await import('./dispositions-card');

describe('DispositionsCard (R4)', () => {
  it('lists the dispositions by class and says how many lots wait for a decision', () => {
    render(<DispositionsCard scope={{ unitIds: [], from: '', to: '', approvedOnly: true } as unknown as Parameters<typeof DispositionsCard>[0]['scope']} />);
    expect(screen.getAllByTestId('disposition-group')).toHaveLength(2);
    expect(screen.getByTestId('quality-pending')).toHaveTextContent('1 lot waits for a quality decision');
  });
});
