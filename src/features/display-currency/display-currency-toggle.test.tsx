import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayCurrencyToggle } from './display-currency-toggle';

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewMoney: true }) }));
vi.mock('./use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'USD', setCurrency: vi.fn() }) }));

describe('DisplayCurrencyToggle', () => {
  it('renders nothing while the display currency switch is disabled, even for a role that sees money', () => {
    const { container } = render(<DisplayCurrencyToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});
