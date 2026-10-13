import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RcaPolicyActivity } from './rca-policy-activity';

const flag = { enabled: false, loading: false };
vi.mock('@/api/v2/queries/feature-flags', () => ({ useFlag: () => flag }));

describe('RcaPolicyActivity (RCA-03)', () => {
  beforeEach(() => {
    flag.enabled = false;
    flag.loading = false;
  });

  it('says the policy does not fire while the plant still uses the legacy trigger configuration', () => {
    render(<RcaPolicyActivity />);
    expect(screen.getByRole('alert')).toHaveTextContent('These trigger settings are not active on this plant');
    expect(screen.getByRole('alert')).toHaveTextContent('v2.rca');
  });

  it('shows nothing once the plant uses these settings, or while the flag is loading', () => {
    flag.enabled = true;
    const { container, rerender } = render(<RcaPolicyActivity />);
    expect(container).toBeEmptyDOMElement();
    flag.enabled = false;
    flag.loading = true;
    rerender(<RcaPolicyActivity />);
    expect(container).toBeEmptyDOMElement();
  });
});
