import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopEventProbability } from './top-event-probability';

describe('TopEventProbability (RCA-06)', () => {
  it('shows the probability the server computed from the saved tree', () => {
    render(<TopEventProbability record={{ topEventProbability: 0.095, topEventProbabilityReason: null }} />);
    expect(screen.getByTestId('ft-top-probability')).toHaveTextContent('9.5 %');
  });

  it('says why it is not available instead of showing a number', () => {
    render(<TopEventProbability record={{ topEventProbability: null, topEventProbabilityReason: 'probability_missing' }} />);
    expect(screen.getByTestId('ft-top-probability')).toHaveTextContent('Not available: a basic event has no probability');
  });

  it('shows nothing before the tree is saved', () => {
    const { container } = render(<TopEventProbability record={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
