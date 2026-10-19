import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Mirror from './server-role-sets';

/** Pins every mirrored role set to the server source it copies: a server change fails this test. */
const SERVER = join(process.cwd(), 'server', 'pro-act-backend', 'src');

function serverList(file: string, name: string): string[] {
  const text = readFileSync(join(SERVER, file), 'utf8');
  const match = new RegExp(String.raw`const ${name}(?::[^=]*)?\s*=\s*(?:new Set\()?\[([^\]]*)\]`).exec(text);
  if (!match) throw new Error(`${name} not found in ${file}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const PINS: ReadonlyArray<[mirror: readonly string[], file: string, name: string]> = [
  [Mirror.PLAN_WRITERS, 'v2/plans/plan-roles.ts', 'PLAN_WRITERS'],
  [Mirror.PLAN_APPROVERS, 'v2/plans/plan-roles.ts', 'PLAN_APPROVERS'],
  [Mirror.PROFILE_WRITERS, 'v2/profiles/profile-roles.ts', 'PROFILE_WRITERS'],
  [Mirror.PROFILE_APPROVERS, 'v2/profiles/profile-roles.ts', 'PROFILE_APPROVERS'],
  [Mirror.CALENDAR_WRITERS, 'v2/calendars/calendar-roles.ts', 'CALENDAR_WRITERS'],
  [Mirror.PERIOD_WRITERS, 'v2/periods/period-roles.ts', 'PERIOD_WRITERS'],
  [Mirror.ADJUSTMENT_APPROVERS, 'v2/periods/period-roles.ts', 'ADJUSTMENT_APPROVERS'],
  [Mirror.REVISION_APPROVERS, 'v2/periods/period-roles.ts', 'REVISION_APPROVERS'],
  [Mirror.CORRECTION_PROPOSERS, 'v2/periods/period-roles.ts', 'CORRECTION_PROPOSERS'],
  [Mirror.DISPOSITION_WRITERS, 'v2/quality-dispositions/disposition-roles.ts', 'DISPOSITION_WRITERS'],
  [Mirror.DISPOSITION_APPROVERS, 'v2/quality-dispositions/disposition-roles.ts', 'DISPOSITION_APPROVERS'],
  [Mirror.STOP_VERIFIERS, 'v2/production-events/verification-roles.ts', 'STOP_VERIFIERS'],
  [Mirror.FAILURE_VALIDATORS, 'v2/production-events/verification-roles.ts', 'FAILURE_VALIDATORS'],
  [Mirror.EVENT_WRITERS, 'v2/production-events/event-write-roles.ts', 'EVENT_WRITERS'],
  [Mirror.BUDGET_WRITERS, 'v2/uncertainty/uncertainty-roles.ts', 'BUDGET_WRITERS'],
  [Mirror.BUDGET_APPROVERS, 'v2/uncertainty/uncertainty-roles.ts', 'BUDGET_APPROVERS'],
  [Mirror.TOLERANCE_ADOPTERS, 'v2/uncertainty/uncertainty-roles.ts', 'TOLERANCE_ADOPTERS'],
  [Mirror.SOURCE_AUTHORITY_WRITERS, 'v2/source-authority/source-authority-roles.ts', 'SOURCE_AUTHORITY_WRITERS'],
  [Mirror.SOURCE_AUTHORITY_APPROVERS, 'v2/source-authority/source-authority-roles.ts', 'SOURCE_AUTHORITY_APPROVERS'],
  [Mirror.DELEGATION_WRITERS, 'v2/administration/administration-roles.ts', 'DELEGATION_WRITERS'],
  [Mirror.UNIT_IMPACT_RULE_WRITERS, 'v2/plant-model/unit-impact-roles.ts', 'UNIT_IMPACT_RULE_WRITERS'],
  [Mirror.UNIT_IMPACT_RULE_APPROVERS, 'v2/plant-model/unit-impact-roles.ts', 'UNIT_IMPACT_RULE_APPROVERS'],
  [Mirror.CODE_WRITERS, 'v2/code-libraries/code-library-v2.controller.ts', 'CODE_WRITERS'],
  [Mirror.RULE_AUTHORS, 'v2/rules/rules-v2.controller.ts', 'RULE_AUTHORS'],
  [Mirror.RULE_APPROVERS, 'v2/rules/rules-v2.controller.ts', 'RULE_APPROVERS'],
  [Mirror.RCA_WRITERS, 'rca-case/rca-scope.ts', 'RCA_WRITERS'],
  [Mirror.INTEGRATION_WRITERS, 'v2/intake/intake-roles.ts', 'INTEGRATION_WRITERS'],
  [Mirror.FINANCE_MAINTAINERS, 'v2/valuation/valuation-roles.ts', 'FINANCE_MAINTAINERS'],
  [Mirror.FINANCE_APPROVERS, 'v2/valuation/valuation-roles.ts', 'FINANCE_APPROVERS'],
  [Mirror.QUANTITY_CLOSERS, 'v2/close/close-roles.ts', 'QUANTITY_CLOSERS'],
  [Mirror.FINANCE_SIGNERS, 'v2/close/close-roles.ts', 'FINANCE_SIGNERS'],
  [Mirror.MATERIALITY_REVIEWERS, 'v2/close/close-roles.ts', 'MATERIALITY_REVIEWERS'],
  [Mirror.MONTH_REOPENERS, 'v2/close/close-roles.ts', 'MONTH_REOPENERS'],
  [Mirror.POSTING_DECIDERS, 'v2/close/close-roles.ts', 'POSTING_DECIDERS'],
  [Mirror.DAY_CERTIFIERS, 'v2/close/close-roles.ts', 'DAY_CERTIFIERS'],
  [Mirror.STATUS_MAPPING_AUTHORS, 'v2/close/close-roles.ts', 'STATUS_MAPPING_AUTHORS'],
  [Mirror.SOURCE_OWNERS, 'v2/close/close-roles.ts', 'SOURCE_OWNERS'],
  [Mirror.STANDBY_WRITERS, 'v2/reliability/reliability-roles.ts', 'STANDBY_WRITERS'],
  [Mirror.WORK_ORDER_WRITERS, 'v2/reliability/reliability-roles.ts', 'WORK_ORDER_WRITERS'],
  [Mirror.STATE_MAPPING_WRITERS, 'v2/reliability/reliability-roles.ts', 'STATE_MAPPING_WRITERS'],
  [Mirror.AUDIT_READERS, 'audit-log/audit-roles.ts', 'AUDIT_READERS'],
  [Mirror.READ_ONLY_ROLES, 'auth/guards/write-access.guard.ts', 'READ_ONLY_ROLES'],
  [Mirror.MONEY_EXCLUDED_ROLES, 'auth/money/money-access.ts', 'MONEY_EXCLUDED_ROLES'],
];

describe('server role sets mirror', () => {
  it.each(PINS)('%j equals %s %s', (mirror, file, name) => {
    expect([...mirror]).toEqual(serverList(file, name));
  });

  it('replay needs the same roles as the other integration writes', () => {
    expect(serverList('v2/intake/intake-roles.ts', 'REPLAY_ROLES')).toEqual([...Mirror.INTEGRATION_WRITERS]);
  });

  it('feature flags are switched by manager approvers only', () => {
    const text = readFileSync(join(SERVER, 'v2/feature-flags/feature-flags-v2.controller.ts'), 'utf8');
    const roles = [...text.matchAll(/@Roles\(([^)]*)\)/g)].map((m) => m[1].replace(/'/g, '').split(/,\s*/));
    expect(roles).toEqual([[...Mirror.FLAG_WRITERS]]);
  });

  it('RCA policies are written by manager approvers only', () => {
    const text = readFileSync(join(SERVER, 'v2/rca-policies/rca-policies-v2.controller.ts'), 'utf8');
    const roles = [...text.matchAll(/@Roles\(([^)]*)\)/g)].map((m) => m[1].replace(/'/g, '').split(/,\s*/));
    expect(roles).toEqual([[...Mirror.RCA_POLICY_WRITERS]]);
  });

  it('micro-stop and transition-allowance policies are written by manager approvers only', () => {
    for (const file of ['v2/reliability/micro-stop-policy-v2.controller.ts', 'v2/reliability/transition-allowance-v2.controller.ts']) {
      const text = readFileSync(join(SERVER, file), 'utf8');
      const roles = [...text.matchAll(/@Roles\(([^)]*)\)/g)].map((m) => m[1].replace(/'/g, '').split(/,\s*/));
      expect(roles).toEqual([[...Mirror.OEE_POLICY_WRITERS]]);
    }
  });

  it('valuation policies, FX rates and valuation rates use the finance sets (SME V1)', () => {
    for (const file of [
      'v2/valuation/valuation-policies-v2.controller.ts',
      'v2/valuation/fx-rates-v2.controller.ts',
      'v2/profiles/valuation-rates-v2.controller.ts',
    ]) {
      const text = readFileSync(join(SERVER, file), 'utf8');
      const sets = [...text.matchAll(/@Roles\(\.\.\.([A-Z_]+)\)/g)].map((m) => m[1]);
      expect(sets.length).toBeGreaterThan(0);
      expect(new Set(sets)).toEqual(new Set(['FINANCE_MAINTAINERS', 'FINANCE_APPROVERS']));
    }
  });

  it('satisfiesAnyRole mirrors satisfiesRole: SuperAdmin anything, OrgAdmin all but SuperAdmin', () => {
    expect(Mirror.satisfiesAnyRole(['SuperAdmin'], ['SuperAdmin'])).toBe(true);
    expect(Mirror.satisfiesAnyRole(['OrgAdmin'], ['manager_approver'])).toBe(true);
    expect(Mirror.satisfiesAnyRole(['OrgAdmin'], ['SuperAdmin'])).toBe(false);
    expect(Mirror.satisfiesAnyRole(['Engineer', 'production_engineer'], ['manager_approver'])).toBe(false);
  });
});

describe('approval inbox deciders (QA_SHELL W-OP)', () => {
  const ALIASES: Readonly<Record<string, readonly string[]>> = { STOP_DECISION_ROLES: Mirror.EVENT_WRITERS };
  const rolesOf = (token: string): readonly string[] => {
    if (token.startsWith('[')) return [...token.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const mirrored = (Mirror as Record<string, unknown>)[token] ?? ALIASES[token];
    if (!Array.isArray(mirrored)) throw new Error(`${token} is not mirrored`);
    return mirrored as readonly string[];
  };

  it.each(['v2/approvals/approval-workflows.ts', 'v2/approvals/approval-catalog.ts'])('every decider role of %s is in APPROVAL_DECIDERS', (file) => {
    const text = readFileSync(join(SERVER, file), 'utf8');
    const tokens = [...text.matchAll(/\broles: (\[[^\]]*\]|[A-Z_]+)/g)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      for (const role of rolesOf(token)) expect(Mirror.APPROVAL_DECIDERS).toContain(role);
    }
  });

  it('leaves out the roles that decide nothing', () => {
    for (const role of ['finance_maintainer', 'master_data_admin', 'integration_admin', 'viewer']) {
      expect(Mirror.APPROVAL_DECIDERS).not.toContain(role);
    }
  });
});
