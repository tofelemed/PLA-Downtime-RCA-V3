import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FormActions } from './components/form-actions';
import { dictionaryEntryName } from './reliability/dictionary-entry-name';

describe('master data QA fixes (2026-10-19)', () => {
  it('L4: "Save changes" waits for an edit and says why; Create and an edited record are enabled', () => {
    const { rerender } = render(<MemoryRouter><FormActions isNew={false} saving={false} dirty={false} cancelTo="/x" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByTestId('disabled-reason')).toHaveTextContent('No changes to save.');
    rerender(<MemoryRouter><FormActions isNew={false} saving={false} dirty cancelTo="/x" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    rerender(<MemoryRouter><FormActions isNew saving={false} dirty={false} cancelTo="/x" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('L9: a pending entry says "pending" once', () => {
    expect(dictionaryEntryName({ name: 'Investigation pending', isPending: true })).toBe('Investigation pending');
    expect(dictionaryEntryName({ name: 'Gearbox wear', isPending: true })).toBe('Gearbox wear (pending)');
    expect(dictionaryEntryName({ name: 'Gearbox wear', isPending: false })).toBe('Gearbox wear');
  });
});
