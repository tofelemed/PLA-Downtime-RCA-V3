import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PICKER_ROW_LIMIT, ReasonCodePicker } from './reason-code-picker';

const codes = [
  {
    id: 'm',
    code: 'MECH',
    name: 'Mechanical',
    parentId: null,
    path: 'm',
    active: true,
  },
  {
    id: 's',
    code: 'SEAL',
    name: 'Seal failure',
    parentId: 'm',
    path: 'm/s',
    active: true,
  },
  {
    id: 'e',
    code: 'ELEC',
    name: 'Electrical trip',
    parentId: null,
    path: 'e',
    active: true,
  },
  {
    id: 'x',
    code: 'OLD',
    name: 'Old cause',
    parentId: null,
    path: 'x',
    active: false,
  },
];

beforeAll(() => {
  // cmdk and Radix measure and scroll; jsdom has neither
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => undefined;
});

const open = () => fireEvent.click(screen.getByRole('combobox', { name: /Reason code/ }));
const optionTexts = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('ReasonCodePicker (FE-04)', () => {
  it('shows the tree with groups not selectable and picks a leaf', () => {
    const onChange = vi.fn();
    render(<ReasonCodePicker id="r" codes={codes} value="" onChange={onChange} />);
    open();
    expect(optionTexts()).toEqual(['— none —', 'ELECElectrical trip', 'MECHMechanical', 'SEALSeal failure']);
    expect(screen.getByRole('option', { name: /Mechanical/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: /Seal failure/ }));
    expect(onChange).toHaveBeenCalledWith('s');
  });

  it('searches by code and name and says when nothing matches', () => {
    render(<ReasonCodePicker id="r" codes={codes} value="" onChange={() => undefined} />);
    open();
    const search = screen.getByRole('combobox', {
      name: 'Search reason codes',
    });
    fireEvent.change(search, { target: { value: 'seal' } });
    expect(optionTexts()).toEqual(['MECHMechanical', 'SEALSeal failure']);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No reason code matches “zzz”.')).toBeInTheDocument();
  });

  it('names the current value on the trigger, a retired one included', () => {
    render(<ReasonCodePicker id="r" codes={codes} value="x" onChange={() => undefined} />);
    expect(within(screen.getByRole('combobox', { name: /Reason code/ })).getByText('OLD · Old cause (retired)')).toBeInTheDocument();
  });

  it('renders a bounded number of rows and says how to narrow', () => {
    const many = Array.from({ length: PICKER_ROW_LIMIT + 5 }, (_, i) => ({
      id: `c${i}`,
      code: `C${String(i).padStart(4, '0')}`,
      name: `Cause ${i}`,
      parentId: null,
      path: `c${i}`,
      active: true,
    }));
    render(<ReasonCodePicker id="r" codes={many} value="" onChange={() => undefined} emptyLabel={null} />);
    open();
    expect(screen.getAllByRole('option')).toHaveLength(PICKER_ROW_LIMIT);
    expect(screen.getByText(`Showing ${PICKER_ROW_LIMIT} of ${PICKER_ROW_LIMIT + 5} rows — type to narrow the list.`)).toBeInTheDocument();
  });
});
