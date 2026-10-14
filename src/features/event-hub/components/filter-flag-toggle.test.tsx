import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterFlagToggle } from './filter-flag-toggle';

describe('FilterFlagToggle (DT-04, SME D5)', () => {
  it('is labelled, shows its state and reports a tick', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterFlagToggle id="filter-possible-repeats" label="Possible repeat stops only" title="t" checked={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Possible repeat stops only' }));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<FilterFlagToggle id="filter-possible-repeats" label="Possible repeat stops only" title="t" checked onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Possible repeat stops only' })).toBeChecked();
  });
});
