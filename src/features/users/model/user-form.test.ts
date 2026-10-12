import { describe, expect, it } from 'vitest';
import type { UserView } from '@/api/v2/types/administration';
import { EMPTY_USER_FORM, formOf, toCreateInput, toUpdateInput, validateUserForm } from './user-form';

const user: UserView = {
  id: 'u1',
  name: 'Anna Keller',
  email: 'anna@demo.test',
  role: 'Operator',
  isActive: true,
  tenantId: 't1',
  tenantName: 'Demo Plant',
  organizationId: 'o1',
  organizationName: 'Demo Org',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  manageable: true,
  accessManageable: true,
};

describe('user form model', () => {
  it('requires name, e-mail, role and a first password of 8 characters', () => {
    expect(validateUserForm(EMPTY_USER_FORM, 'create')).toEqual({
      name: 'Enter the user’s name.',
      email: 'Enter a valid e-mail address.',
      role: 'Choose a role.',
      password: 'Enter a first password.',
    });
    const short = { ...EMPTY_USER_FORM, name: 'A', email: 'a@b.co', role: 'Operator' as const, password: 'short' };
    expect(validateUserForm(short, 'create')).toEqual({ password: 'Use at least 8 characters.' });
  });

  it('accepts an edit without a new password', () => {
    expect(validateUserForm(formOf(user), 'edit')).toEqual({});
  });

  it('sends only what changed on edit', () => {
    expect(toUpdateInput(formOf(user), user)).toEqual({});
    expect(toUpdateInput({ ...formOf(user), role: 'Manager', password: 'NewSecret1' }, user)).toEqual({
      role: 'Manager',
      password: 'NewSecret1',
    });
  });

  it('builds a create payload with a trimmed name and the chosen plant', () => {
    const values = { name: ' Ida ', email: 'ida@x.io ', password: 'Secret-123', role: 'Engineer' as const, tenantId: 't2' };
    expect(toCreateInput(values)).toEqual({ name: 'Ida', email: 'ida@x.io', password: 'Secret-123', role: 'Engineer', tenantId: 't2' });
    expect(toCreateInput({ ...values, tenantId: '' })).not.toHaveProperty('tenantId');
  });
});
