import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reasonCodeOf } from './downtime-pareto-bars';
import { legendText } from './downtime-trend-bars';

describe('dashboard chart labels', () => {
  it('shows only the reason code on the Pareto axis', () => {
    expect(reasonCodeOf('M-101 · Gearbox failure')).toBe('M-101');
    expect(reasonCodeOf('Not categorised')).toBe('Not categorised');
  });

  it('draws legend text in the foreground token', () => {
    render(<>{legendText('Not classified')}</>);
    expect(screen.getByText('Not classified')).toHaveStyle({ color: 'hsl(var(--foreground))' });
  });
});
