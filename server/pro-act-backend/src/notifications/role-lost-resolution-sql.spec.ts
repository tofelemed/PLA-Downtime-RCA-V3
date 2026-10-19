import { ROLE_LOST, ROLE_LOST_SELECT } from './role-lost-resolution-sql';
import { RESOLUTION_STATEMENTS } from './work-item-resolution-sql';

describe('role-lost reminder resolution SQL', () => {
  it('runs after the work-done resolutions', () => {
    expect(RESOLUTION_STATEMENTS[RESOLUTION_STATEMENTS.length - 1]).toBe(
      ROLE_LOST,
    );
  });

  it('addresses the reminder kinds by their recipient roles', () => {
    expect(ROLE_LOST_SELECT).toContain(
      `ARRAY['operator', 'production_engineer']::text[]`,
    );
    expect(ROLE_LOST_SELECT).toContain(
      `ARRAY['production_engineer', 'manager_approver']::text[]`,
    );
    expect(ROLE_LOST_SELECT).toContain(`n2."detail"->>'recipient' = 'checker'`);
    expect(ROLE_LOST_SELECT).toContain(`ARRAY[n2."detail"->>'role']::text[]`);
  });

  it('counts the D06 legacy fallback only without an own grant, like roleHoldersOf', () => {
    expect(ROLE_LOST_SELECT).toContain(`('Manager', 'manager_approver')`);
    expect(ROLE_LOST_SELECT).toContain(
      'NOT EXISTS (SELECT 1 FROM "user_scopes" own',
    );
  });

  it('resolves as superseded, never completed', () => {
    expect(ROLE_LOST).toContain(`"resolution" = 'superseded'`);
    expect(ROLE_LOST).not.toContain(`'completed'`);
  });
});
