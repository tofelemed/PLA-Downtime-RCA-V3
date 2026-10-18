import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as RoleSets from '@/features/auth/server-role-sets';
import { assertNoRawId, looksLikeRawId, resetNoRawIdWarnings } from './assert-no-raw-id';
import { featureLabel, featureOffMessage, FEATURE_LABELS } from './feature-labels';
import { humanize, labelOf } from './humanize';
import { policyLabel, policyRefsLabel, policyVersionsLabel } from './policy-labels';
import { ROLE_LABELS, roleLabel, roleListLabel } from './role-labels';
import { READINESS_LABELS } from './workflow-labels';
import { PHYSICAL_STATE_LABELS } from './event-labels';

const ROLE_MODEL = join(process.cwd(), 'server', 'pro-act-backend', 'src', 'auth', 'roles', 'role-model.ts');

function serverRoles(name: string): string[] {
  const text = readFileSync(ROLE_MODEL, 'utf8');
  const match = new RegExp(String.raw`export const ${name} = \[([^\]]*)\]`).exec(text);
  if (!match) throw new Error(`${name} not found in role-model.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('humanize / labelOf', () => {
  it('turns tokens into sentence case and keeps acronyms', () => {
    expect(humanize('complete_inputs')).toBe('Complete inputs');
    expect(humanize('camelCaseKey')).toBe('Camel case key');
    expect(humanize('oee_policy')).toBe('OEE policy');
    expect(humanize('OEE')).toBe('OEE');
    expect(humanize('UOM_MIXED')).toBe('UOM mixed');
    expect(humanize('totalOEEValue')).toBe('Total OEE value');
    expect(humanize('assetId')).toBe('Asset ID');
    expect(humanize('planned-shutdown')).toBe('Planned shutdown');
    expect(humanize('')).toBe('');
  });

  it('labelOf uses the map, humanizes unknown values and never returns the raw token', () => {
    expect(labelOf(READINESS_LABELS, 'complete_inputs')).toBe('Inputs complete');
    expect(labelOf(PHYSICAL_STATE_LABELS, 'open')).toBe('Ongoing');
    expect(labelOf(READINESS_LABELS, 'brand_new_state')).toBe('Brand new state');
    expect(labelOf(READINESS_LABELS, null)).toBe('—');
    expect(labelOf(READINESS_LABELS, undefined, 'Not set')).toBe('Not set');
    expect(labelOf(READINESS_LABELS, 'toString')).toBe('To string');
  });
});

describe('role labels', () => {
  it('names every role of the server role model and of the mirrored role sets', () => {
    const mirrored = Object.values(RoleSets).filter(Array.isArray).flat() as string[];
    const roles = new Set([...serverRoles('LEGACY_ROLES'), ...serverRoles('SCOPE_ROLES'), ...mirrored]);
    expect(roles.size).toBeGreaterThanOrEqual(14);
    for (const role of roles) expect(Object.keys(ROLE_LABELS)).toContain(role);
  });

  it('shows plain names, never the token', () => {
    expect(roleLabel('TenantAdmin')).toBe('Plant administrator');
    expect(roleLabel('manager_approver')).toBe('Manager (approver)');
    expect(roleLabel('SuperAdmin')).toBe('Super administrator');
    expect(roleLabel('some_new_role')).toBe('Some new role');
    expect(roleLabel(null)).toBe('—');
    expect(roleListLabel(['Operator', 'operator', 'viewer'])).toBe('Operator, Viewer');
  });
});

describe('policy and feature labels', () => {
  it('formats policy refs', () => {
    expect(policyLabel('oee_policy@1')).toBe('OEE policy v1');
    expect(policyLabel('reconciliation_tolerance@1')).toBe('Reconciliation tolerance v1');
    expect(policyLabel('valuation_basis')).toBe('Valuation basis');
    expect(policyLabel('shiny_rule@4')).toBe('Shiny rule v4');
    expect(policyVersionsLabel('oee_policy@3,loss_policy@2')).toBe('OEE policy v3 · Loss policy v2');
    expect(policyVersionsLabel(['valuation_basis@2'])).toBe('Valuation basis v2');
    expect(policyVersionsLabel('')).toBe('—');
    expect(policyRefsLabel([{ kind: 'oee_policy', version: 1 }, { kind: 'rca_policy', version: 2 }])).toBe('OEE policy v1 · RCA policy v2');
  });

  it('names feature flags and tells who can turn them on', () => {
    expect(featureLabel('v2.codesAdmin')).toBe('Codes & rules');
    expect(featureOffMessage('v2.codesAdmin')).toBe('Codes & rules is not turned on for this plant. Ask a plant administrator to turn it on.');
    expect(featureLabel('v2.futureThing')).toBe('Future thing');
    for (const label of Object.values(FEATURE_LABELS)) expect(label).not.toMatch(/v2\./);
  });
});

describe('no raw ids', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetNoRawIdWarnings();
  });

  it('recognises UUIDs, entity-prefixed UUIDs and hex id slices', () => {
    expect(looksLikeRawId('3f2a9c1b-1234-4abc-8def-0123456789ab')).toBe(true);
    expect(looksLikeRawId('loss_3f2a9c1b-1234-4abc-8def-0123456789ab')).toBe(true);
    expect(looksLikeRawId('by user d9800d1c')).toBe(true);
    expect(looksLikeRawId('d9800d1c')).toBe(true);
    expect(looksLikeRawId('Unit 100')).toBe(false);
    expect(looksLikeRawId('12345678')).toBe(false);
    expect(looksLikeRawId('Feedback received')).toBe(false);
    expect(looksLikeRawId('2026-10-09 06:00')).toBe(false);
  });

  it('warns once per (where, value) in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    assertNoRawId('d9800d1c', 'events table');
    assertNoRawId('d9800d1c', 'events table');
    assertNoRawId('Pump 3', 'events table');
    assertNoRawId(42, 'events table');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('[no-raw-id] events table renders an internal id');
    assertNoRawId('d9800d1c', 'plan grid');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('accounting labels (Marun regression G3)', () => {
  it('names a loss basis and a segment method in words, never the raw key', async () => {
    const { lossBasisLabel, segmentMethodLabel } = await import('./accounting-labels');
    expect(lossBasisLabel('planning_rate')).toBe('Planning rate');
    expect(lossBasisLabel('new_basis')).toBe('New basis');
    expect(segmentMethodLabel('counter_delta/step:delta')).toBe('Counter difference, step interpolation, counted');
    expect(segmentMethodLabel('rate_integration/linear:gap')).toBe('Rate integration, linear interpolation, no data');
    expect(segmentMethodLabel('output_events')).toBe('Output events');
    expect(segmentMethodLabel('odd_engine/curve:blip')).toBe('Odd engine, curve, blip');
  });
});
