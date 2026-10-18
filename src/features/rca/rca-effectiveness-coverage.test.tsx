import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RcaActionView } from '@/api/v2/types/rca';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ActionVerdict } = await import('./actions/action-verdict');

const EVALUATED = {
  verdict: 'insufficient_evidence',
  postAction: {
    windowDays: 30,
    recurrences: 0,
    observedLossSeconds: '0',
    from: '2026-09-01T00:00:00Z',
    to: '2026-10-01T00:00:00Z',
    evaluatedAt: '2026-10-01T01:00:00Z',
    realized: null,
    exposure: { from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z', incidents: 0, downtimeSeconds: '0', exposureSeconds: '0', coverage: '0.94', unknownSeconds: '155520' },
    effectiveness: {
      verdict: 'insufficient_evidence',
      baselineRate: '5',
      postRate: '0',
      reduction: '1',
      mtbfLowerBound95Hours: null,
      reasons: ['state data covers 94 % of the window after the action (43.2 h without data); a verdict needs at least 95 % coverage'],
      coverage: { baseline: '0.9', post: '0.94', minimum: '0.95' },
    },
  },
} as unknown as RcaActionView;

describe('RCA effectiveness verdict coverage (owner, 18 Oct 2026)', () => {
  it('shows the post-action coverage against the policy minimum, the baseline coverage and the server reason', () => {
    render(<ActionVerdict action={EVALUATED} />);
    expect(screen.getByTestId('verdict-coverage')).toHaveTextContent('State-data coverage: after the action 94.0 % (minimum 95.0 %) · baseline 90.0 %');
    expect(screen.getByText(/a verdict needs at least 95 % coverage/)).toBeInTheDocument();
  });

  it('shows the state-mapping reason of a unit without a mapping', () => {
    const effectiveness = { ...(EVALUATED.postAction?.effectiveness ?? {}), reasons: ['needs a state mapping for this unit'], coverage: { baseline: null, post: '0', minimum: '0.95' } };
    const action = { ...EVALUATED, postAction: { ...EVALUATED.postAction, effectiveness } } as unknown as RcaActionView;
    render(<ActionVerdict action={action} />);
    expect(screen.getByText('needs a state mapping for this unit')).toBeInTheDocument();
    expect(screen.getByTestId('verdict-coverage')).toHaveTextContent('after the action 0.0 % (minimum 95.0 %)');
  });

  it('verdicts stored before the coverage was recorded show no coverage line', () => {
    const effectiveness = { ...(EVALUATED.postAction?.effectiveness ?? {}), coverage: undefined };
    const action = { ...EVALUATED, postAction: { ...EVALUATED.postAction, effectiveness } } as unknown as RcaActionView;
    render(<ActionVerdict action={action} />);
    expect(screen.queryByTestId('verdict-coverage')).toBeNull();
  });
});
