import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReasonCodePicker } from './reason-code-picker';

const codes = [
  { id: 'm', code: 'MECH', name: 'Mechanical', parentId: null, path: 'MECH', active: true },
  { id: 's', code: 'SEAL', name: 'Seal failure', parentId: 'm', path: 'MECH/SEAL', active: true },
  { id: 'e', code: 'ELEC', name: 'Electrical trip', parentId: null, path: 'ELEC', active: true },
];

describe('ReasonCodePicker (FE-04)', () => {
  it('searches the codes and picks a leaf', () => {
    const onChange = vi.fn();
    render(<ReasonCodePicker id="r" codes={codes} value="" onChange={onChange} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '— none —',
      'ELEC · Electrical trip',
      'SEAL · Seal failure — Mechanical',
    ]);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search reason codes' }), { target: { value: 'seal' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['— none —', 'SEAL · Seal failure — Mechanical']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason code' }), { target: { value: 's' } });
    expect(onChange).toHaveBeenCalledWith('s');
  });

  it('says when nothing matches', () => {
    render(<ReasonCodePicker id="r" codes={codes} value="" onChange={() => undefined} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search reason codes' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No reason code matches “zzz”.')).toBeInTheDocument();
  });
});
