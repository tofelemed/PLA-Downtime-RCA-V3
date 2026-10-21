import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarPreferenceContext } from '@/lib/dates';
import { ScopeHeader } from './scope-header';

const NOW = Date.parse('2026-10-12T08:00:00Z');

describe('ScopeHeader follows the plant date settings (settings audit, 21 Oct 2026)', () => {
  it('shows "As of", the freshness and the zone offset in the plant calendar and digits', () => {
    render(
      <CalendarPreferenceContext.Provider value={{ calendar: 'persian', digits: 'persian' }}>
        <ScopeHeader scopeLabel="HDPE" timezone="Asia/Tehran" asOf="2026-10-12T07:57:00Z" now={NOW} />
      </CalendarPreferenceContext.Provider>,
    );
    const header = screen.getByTestId('scope-header');
    expect(header).toHaveTextContent('۱۴۰۵/۰۷/۲۰');
    expect(header).toHaveTextContent('۳ min ago');
    expect(header).toHaveTextContent('(+۰۳:۳۰)');
    expect(header.textContent).not.toMatch(/2026/);
  });
});
