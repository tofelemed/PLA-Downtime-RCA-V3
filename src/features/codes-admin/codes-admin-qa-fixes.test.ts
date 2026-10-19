import { describe, expect, it } from 'vitest';
import { CODE_LIBRARY_EMPTY } from './model/code-fields';
import { createDisabledReason, newCodeErrors } from './model/new-code';

describe('codes QA fixes (2026-10-19)', () => {
  it('L7: the new-code dialog checks the pattern and duplicates inline', () => {
    expect(newCodeErrors('bad code!', [])).toEqual({ code: expect.stringContaining('letters, digits and . _ : -') });
    expect(newCodeErrors('MECH-GEARBOX', ['MECH-GEARBOX'])).toEqual({ code: 'MECH-GEARBOX already exists in this library.' });
    expect(newCodeErrors('MECH-NEW.1:a_b', ['MECH-GEARBOX'])).toEqual({});
    expect(newCodeErrors('', [])).toEqual({});
  });

  it('L7: Create says why it is disabled', () => {
    expect(createDisabledReason('', '', {})).toBe('Enter a code and a name.');
    expect(createDisabledReason('', 'Gearbox', {})).toBe('Enter a code.');
    expect(createDisabledReason('bad code!', 'Gearbox', newCodeErrors('bad code!', []))).toBe('Fix the code first.');
    expect(createDisabledReason('MECH-NEW', '', {})).toBe('Enter a name.');
    expect(createDisabledReason('MECH-NEW', 'New', {})).toBeNull();
  });

  it('L6: one empty state for every code library', () => {
    expect(CODE_LIBRARY_EMPTY).toEqual({ title: 'No codes yet', text: 'Create the first code of this library.' });
  });
});
