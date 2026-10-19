import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { ADMINISTRATION_ROUTES } from '@/app/routes/administration';
import { fxRateText } from './model/fx-rate-text';
import { inForceBasis, policyFormOf } from './model/policy-form';

const viewer = vi.hoisted(() => ({ id: 'u-darya' as string | null }));
vi.mock('@/features/auth/use-current-user-id', () => ({ useCurrentUserId: () => viewer.id }));
vi.mock('@/features/ux-kit/labels/use-user-names', () => ({
  useUserNames: () => ({ nameOf: (id: string | null | undefined) => ({ 'u-darya': 'Darya Rahimi', 'u-kamran': 'Kamran Moradi' })[id ?? ''] ?? 'Former user' }),
}));
const { PolicyPerson } = await import('./components/policy-person');

const policy = (patch: Partial<ValuationPolicyView>): ValuationPolicyView => ({
  id: 'p', version: 1, approved: true, approvedBy: null, approvedAt: '2026-10-01T00:00:00Z', effectiveFrom: '1970-01-01T00:00:00Z', effectiveTo: null,
  body: { defaultBasis: 'economic_impact' }, reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: null, createdAt: '2026-10-01T00:00:00Z', ...patch,
});
const NOW = new Date('2026-10-19T08:00:00Z');

describe('finance QA fixes (2026-10-19)', () => {
  it('M2: the author is the person, "(you)" for the viewer, "System" for a seeded default — never "Another user"', () => {
    const { rerender } = render(<PolicyPerson id="u-darya" />);
    expect(screen.getByTestId('policy-person')).toHaveTextContent('Darya Rahimi (you)');
    rerender(<PolicyPerson id="u-kamran" />);
    expect(screen.getByTestId('policy-person')).toHaveTextContent('Kamran Moradi');
    expect(screen.getByTestId('policy-person')).not.toHaveTextContent('Another user');
    rerender(<PolicyPerson id={null} />);
    expect(screen.getByTestId('policy-person')).toHaveTextContent('System');
  });

  it('L21: an exchange rate reads with thousands separators and every significant digit', () => {
    expect(fxRateText({ rate: '600000', fromCurrency: 'USD', toCurrency: 'IRR' })).toBe('1 USD = 600,000 IRR');
    expect(fxRateText({ rate: '585000.2500000000', fromCurrency: 'USD', toCurrency: 'IRR' })).toBe('1 USD = 585,000.25 IRR');
    expect(fxRateText({ rate: '0.0000016667', fromCurrency: 'IRR', toCurrency: 'USD' })).toBe('1 IRR = 0.0000016667 USD');
  });

  it('L19: a fresh version starts from the basis of the approved version in force', () => {
    const versions = [
      policy({ id: 'p3', version: 3, approved: false, effectiveFrom: '2026-10-18T00:00:00Z', body: { defaultBasis: 'standard_cost' } }),
      policy({ id: 'p2', version: 2, effectiveFrom: '2026-10-17T02:30:00Z', body: { defaultBasis: 'contribution_margin' } }),
      policy({ id: 'p1', version: 1, effectiveTo: '2026-10-17T02:30:00Z' }),
    ];
    expect(inForceBasis(versions, NOW)).toBe('contribution_margin');
    expect(inForceBasis([], NOW)).toBeNull();
    expect(policyFormOf(null, inForceBasis(versions, NOW)).defaultBasis).toBe('contribution_margin');
    expect(policyFormOf(null).defaultBasis).toBe('economic_impact');
  });

  it('L20: the new-version page needs the valuation maintainer capability, not only the Finance menu', () => {
    const route = ADMINISTRATION_ROUTES.find((entry) => entry.path === '/finance/policies/new');
    expect(route?.requires).toBe('canMaintainValuation');
  });
});
