import type { CreateUserInput, LegacyRole, UpdateUserInput, UserView } from '@/api/v2/types/administration';

/** The user form as typed (strings; the role is a legacy role token). */
export interface UserFormValues {
  name: string;
  email: string;
  /** required for a new user; blank on edit = keep the current password */
  password: string;
  role: LegacyRole | '';
  /** home plant of a new user (super / organization administrators choose; others act in their plant) */
  tenantId: string;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMPTY_USER_FORM: UserFormValues = { name: '', email: '', password: '', role: '', tenantId: '' };

export function formOf(user: UserView): UserFormValues {
  return { name: user.name, email: user.email, password: '', role: user.role as LegacyRole, tenantId: user.tenantId ?? '' };
}

/** Field messages in plain language; an empty object means the form can be sent. */
export function validateUserForm(values: UserFormValues, mode: 'create' | 'edit'): UserFormErrors {
  const errors: UserFormErrors = {};
  if (!values.name.trim()) errors.name = 'Enter the user’s name.';
  if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid e-mail address.';
  if (!values.role) errors.role = 'Choose a role.';
  const password = values.password;
  if (mode === 'create' && !password) errors.password = 'Enter a first password.';
  else if (password && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

export function toCreateInput(values: UserFormValues): CreateUserInput {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password,
    role: values.role as LegacyRole,
    ...(values.tenantId ? { tenantId: values.tenantId } : {}),
  };
}

/** Only what changed (an unchanged role is not re-granted; a blank password keeps the current one). */
export function toUpdateInput(values: UserFormValues, original: UserView): UpdateUserInput {
  const input: UpdateUserInput = {};
  if (values.name.trim() !== original.name) input.name = values.name.trim();
  if (values.email.trim() !== original.email) input.email = values.email.trim();
  if (values.role && values.role !== original.role) input.role = values.role;
  if (values.password) input.password = values.password;
  return input;
}
