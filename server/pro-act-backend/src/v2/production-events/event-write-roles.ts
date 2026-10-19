/**
 * Who changes production events and stops (owner decision 2026-10-19, QA audit Q3): create, edit / code,
 * split, merge, bulk code, close, retract, review-item decisions, duplicate-stop decisions and repeat-stop
 * "new failure" marks. Operators, production engineers, reliability engineers and manager approvers; the
 * production accountant reconciles but has read-only coding, and viewers never write. SuperAdmin / OrgAdmin
 * satisfy every role; legacy roles carry their D06 scope role. The UI mirrors this list
 * (`src/features/auth/server-role-sets.ts`, pinned by `server-role-sets.test.ts`).
 */
export const EVENT_WRITERS = [
  'operator',
  'production_engineer',
  'reliability_engineer',
  'manager_approver',
] as const;
