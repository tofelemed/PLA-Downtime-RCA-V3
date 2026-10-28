import { generatePassword } from './password';

describe('generatePassword', () => {
  it('is 22 characters and contains a symbol', () => {
    const password = generatePassword();
    expect(password).toHaveLength(22);
    expect(password).toMatch(/[!@#%^*\-_]/);
    expect(password).toMatch(/^[A-Za-z0-9!@#%^*\-_]+$/);
  });

  it('gives distinct values', () => {
    const all = new Set(Array.from({ length: 100 }, generatePassword));
    expect(all.size).toBe(100);
  });
});
