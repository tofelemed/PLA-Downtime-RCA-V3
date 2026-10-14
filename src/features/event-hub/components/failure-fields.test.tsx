import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import { EMPTY_FORM } from '../model/event-form';
import { dictionaryOptions, equipmentClassOf } from '../model/failure-dictionary-options';
import { FailureFieldsView } from './failure-fields';

const NO_DICTIONARY = { entries: [], assetClass: null };

const entry = (kind: FailureDictionaryEntryView['kind'], code: string, extra: Partial<FailureDictionaryEntryView> = {}): FailureDictionaryEntryView => ({
  id: `${kind}-${code}`,
  kind,
  code,
  name: `${code} name`,
  equipmentClass: '',
  description: null,
  category: null,
  assetTypes: [],
  isPending: false,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  rowVersion: 1,
  ...extra,
});

const DICTIONARY = [
  entry('equipment_class', 'PU', { name: 'Pumps', assetTypes: ['Pump'] }),
  entry('maintainable_item', 'SEAL', { equipmentClass: 'PU' }),
  entry('maintainable_item', 'BRG', { equipmentClass: 'EM' }),
  entry('maintainable_item', 'UNK', { isPending: true }),
];

describe('FailureFields (SME D8 / D11)', () => {
  it('downtime only; severity says which choices count in MTBF', () => {
    const setField = vi.fn();
    const { rerender } = render(<FailureFieldsView form={{ values: { ...EMPTY_FORM, physicalType: 'slowdown' }, errors: {}, setField }} dictionary={NO_DICTIONARY} />);
    expect(screen.queryByTestId('failure-fields')).toBeNull();
    rerender(<FailureFieldsView form={{ values: EMPTY_FORM, errors: {}, setField }} dictionary={NO_DICTIONARY} />);
    expect(screen.getByRole('option', { name: /Incipient.*not a failure/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'critical' } });
    expect(setField).toHaveBeenCalledWith('failureSeverity', 'critical');
    fireEvent.change(screen.getByLabelText('Maintainable item'), { target: { value: 'Seal' } });
    expect(setField).toHaveBeenCalledWith('maintainableItem', 'Seal');
  });

  it('with a dictionary the field picks a code of the asset class; pending first', () => {
    const setField = vi.fn();
    render(<FailureFieldsView form={{ values: EMPTY_FORM, errors: {}, setField }} dictionary={{ entries: DICTIONARY, assetClass: 'PU' }} />);
    const select = screen.getByLabelText('Maintainable item');
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', 'UNK', 'SEAL']);
    fireEvent.change(select, { target: { value: 'SEAL' } });
    expect(setField).toHaveBeenCalledWith('maintainableItem', 'SEAL');
    expect(screen.getByLabelText('Failure mode').tagName).toBe('INPUT');
  });

  it('keeps a stored value that is not in the dictionary selectable', () => {
    const options = dictionaryOptions(DICTIONARY, 'maintainableItem', { assetClass: null, current: 'old seal' });
    expect(options?.map((o) => o.value)).toEqual(['UNK', 'BRG', 'SEAL', 'old seal']);
    expect(equipmentClassOf(DICTIONARY, 'pump')).toBe('PU');
    expect(dictionaryOptions(DICTIONARY, 'failureCause', { assetClass: 'PU', current: '' })).toBeNull();
  });
});
