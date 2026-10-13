import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PossibleDuplicateToggle } from './possible-duplicate-toggle';

describe('PossibleDuplicateToggle (DT-04)', () => {
  it('is labelled and reports the ticked state', () => {
    const onChange = vi.fn();
    render(<PossibleDuplicateToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Possible duplicate stops only' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the current state', () => {
    render(<PossibleDuplicateToggle checked onChange={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: 'Possible duplicate stops only' })).toBeChecked();
  });
});
