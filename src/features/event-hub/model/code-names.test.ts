import { describe, expect, it } from 'vitest';
import { codeNameResolver } from './code-names';

const code = (id: string, active: boolean) => ({ id, code: `R${id}`, name: `Reason ${id}`, active });

describe('codeNameResolver (FE-05)', () => {
  it('names active codes and retired codes, the retired ones marked', () => {
    const nameOf = codeNameResolver([code('1', true), code('2', false)]);
    expect(nameOf('1')).toBe('R1 · Reason 1');
    expect(nameOf('2')).toBe('R2 · Reason 2 (retired)');
  });

  it('a missing code is unknown, no code is a dash', () => {
    const nameOf = codeNameResolver([]);
    expect(nameOf('x')).toBe('Unknown');
    expect(nameOf(null)).toBe('—');
  });
});
