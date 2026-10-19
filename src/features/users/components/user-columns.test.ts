import { describe, expect, it } from 'vitest';
import type { UserView } from '@/api/v2/types/administration';
import { plantRolesText } from './user-columns';

const base = { role: 'Analyst' } as UserView;

describe('users list: plant roles, not the legacy role (QA audit 2026-10-19)', () => {
  it('shows the plant grants', () => {
    expect(plantRolesText({ ...base, plantRoles: ['finance_approver'] })).toBe('Finance approver');
    expect(plantRolesText({ ...base, plantRoles: ['quality_approver', 'production_engineer'] })).toBe('Quality / Lab approver, Production engineer');
  });

  it('says "—" when the user holds no role here, and falls back to the legacy role for an older server', () => {
    expect(plantRolesText({ ...base, plantRoles: [] })).toBe('—');
    expect(plantRolesText(base)).toBe('Analyst');
  });
});
