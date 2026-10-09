import { anonymousContext } from '../../common/context/request-context';
import { canWrite } from './write-access.guard';

describe('canWrite (read-only roles, §13.2)', () => {
  const withRoles = (roles: string[]) => ({
    ...anonymousContext('c'),
    userId: 'u',
    roles,
  });

  it('refuses callers whose only role is viewer, or who have no role', () => {
    expect(canWrite(withRoles(['viewer']))).toBe(false);
    expect(canWrite(withRoles([]))).toBe(false);
  });

  it('allows any caller holding a role that is not read-only', () => {
    expect(canWrite(withRoles(['viewer', 'operator']))).toBe(true);
    expect(canWrite(withRoles(['Analyst', 'production_engineer']))).toBe(true);
  });
});
