import { describe, expect, it } from 'vitest';
import type { RcaCaseReadinessView } from '@/api/v2/types/rca-workflow';
import type { FmeaScoredCause } from '@/api/v2/types/rca-analyses';
import type { RcaPolicyVersion } from '../event-hub/rca-policy/rca-policy-api';
import { draftOf, inputOf } from '../event-hub/rca-policy/rca-policy-draft';
import { causeStatus, rpnText } from './case/analysis/tools/fmea/fmea-model';
import { depthCount } from './case/analysis/tools/five-why/five-why-model';
import { blockersOf, moveReady, transitionBody, workflowMoves } from './model/case-workflow';
import { plantDayOf, plantDayStart } from './model/plant-day';
import { recommendationDetail } from './model/rca-labels';
import { triggerDetailText } from './model/trigger-detail';

const READINESS: RcaCaseReadinessView = {
  rcaId: 'c1',
  status: 'Monitoring',
  next: [
    { to: 'Analysis', gates: ['note'] },
    { to: 'Closure Review', gates: ['closure_request'] },
  ],
  investigation: { blockers: [], advice: [] },
  closure: {
    blockers: [{ code: 'RESIDUAL_RISK_MISSING', field: 'residualRisk', message: 'state how the residual risk is disposed of' }],
    effectiveness: 'effective',
  },
  approver: { canApprove: false, reason: 'closure is approved by a manager approver' },
  linkedRecurrences: 2,
  rules: { fiveWhyGuidelineLevels: 5, fiveWhyUnsupportedRootCauses: ['operator error'], consequenceClass: 'minor' },
};

describe('case workflow model (RCA-01 / SME CA1)', () => {
  const [back, request] = workflowMoves(READINESS);

  it('labels the server moves and knows what each needs', () => {
    expect(back).toMatchObject({ to: 'Analysis', label: 'Back to analysis', needsNote: true });
    expect(request).toMatchObject({ to: 'Closure Review', label: 'Request closure', needsResidualRisk: true, gate: 'closure' });
  });

  it('a closure request is ready once the residual risk is typed; other blockers still block', () => {
    expect(moveReady(request, blockersOf(request, READINESS, ''), { note: '', residualRisk: '' })).toBe(false);
    const typed = 'Spare seal kept on site';
    expect(moveReady(request, blockersOf(request, READINESS, typed), { note: '', residualRisk: typed })).toBe(true);
    const evidence = { ...READINESS, closure: { ...READINESS.closure, blockers: [{ code: 'ACTION_EVIDENCE_MISSING', field: 'actions', message: 'x' }] } };
    expect(moveReady(request, blockersOf(request, evidence, typed), { note: '', residualRisk: typed })).toBe(false);
  });

  it('sends only what the move asks for, trimmed', () => {
    expect(transitionBody(request, { note: '', residualRisk: '  Spare kept  ' })).toEqual({ to: 'Closure Review', residualRisk: 'Spare kept' });
    expect(transitionBody(back, { note: ' repeat seen ', residualRisk: 'x' })).toEqual({ to: 'Analysis', note: 'repeat seen' });
    expect(moveReady(back, [], { note: ' ', residualRisk: '' })).toBe(false);
  });
});

describe('trigger reasons (SME D17 / CA8)', () => {
  it('names repeats, linked repeats, quantity, cost and the critical-asset rule in plain words', () => {
    expect(triggerDetailText({ trigger: 'repeat', detail: { failures: 3, repeatWindowDays: 30, repeatCount: 3 } })).toEqual([
      '3 failures in 30 days (limit 3)',
    ]);
    expect(
      triggerDetailText({ trigger: 'quantity', detail: { lostQuantity: '12.5', thresholdQuantity: '10', uom: 't', criticalAsset: true } }),
    ).toEqual(['lost 12.50 t (limit 10.00 t)', 'critical asset: lower threshold']);
    expect(triggerDetailText({ trigger: 'cost', detail: { amount: '4200.5', currency: 'USD', threshold: 3000 } })).toEqual([
      '4,201 USD (limit 3,000 USD)',
    ]);
    const linked = { outcome: 'linked_to_case', trigger: 'repeat', detail: {}, source: { kind: 'policy', id: 'p', version: 2 }, provisional: false };
    expect(recommendationDetail(linked as never)).toContain('open investigation');
  });
});

describe('FMEA scores come from the server (SME CA5)', () => {
  const cause = (overrides: Partial<FmeaScoredCause>): FmeaScoredCause =>
    ({ id: 'c', description: 'd', occurrence: 4, detection: 3, detectionControl: null, recommendedActions: [], severity: 7, rpn: 84, actionPriority: 'medium', needsAction: false, missing: [], ...overrides }) as FmeaScoredCause;

  it('a missing rating reads as incomplete, never as a default score; before a save it says so', () => {
    expect(causeStatus(cause({ rpn: null, actionPriority: null, needsAction: null, missing: ['detection'] }))).toEqual({
      text: 'Incomplete: detection missing',
      alert: false,
    });
    expect(causeStatus(cause({ missing: ['severity', 'occurrence'] })).text).toBe('Incomplete: severity, occurrence missing');
    expect(causeStatus(undefined)).toEqual({ text: 'Scored after save', alert: false });
  });

  it('shows the server priority and needs-action without a browser threshold', () => {
    expect(causeStatus(cause({ rpn: 40, needsAction: true, severity: 10, actionPriority: 'high' }))).toEqual({ text: 'Priority high · needs action', alert: true });
    expect(causeStatus(cause({}))).toEqual({ text: 'Priority medium', alert: false });
    expect(causeStatus(cause({ actionPriority: null, needsAction: true }))).toEqual({ text: 'needs action', alert: true });
    expect(causeStatus(cause({ actionPriority: null, needsAction: false }))).toEqual({ text: 'No action needed', alert: false });
    expect(causeStatus(cause({ actionPriority: null, needsAction: null }))).toEqual({ text: '—', alert: false });
  });

  it('the RPN column is the server number, or a dash before a save or with a rating missing', () => {
    expect(rpnText(cause({ rpn: 84 }))).toBe('84');
    expect(rpnText(cause({ rpn: null, missing: ['detection'] }))).toBe('—');
    expect(rpnText(undefined)).toBe('—');
  });
});

describe('5-Why depth count (CA6)', () => {
  it('reads against the guideline when there is one, else as plain levels', () => {
    expect(depthCount(3, 5)).toBe('3 of 5 guideline levels');
    expect(depthCount(1, null)).toBe('1 level');
    expect(depthCount(4, null)).toBe('4 levels');
  });
});

describe('plant days (FE-10 family)', () => {
  it('reads an instant as the plant day and keeps a bare day', () => {
    expect(plantDayOf('2026-10-01T20:30:00.000Z', 'Asia/Tehran')).toBe('2026-10-02');
    expect(plantDayOf('2026-10-01T20:30:00.000Z', 'UTC')).toBe('2026-10-01');
    expect(plantDayOf('2026-10-05', 'Asia/Tehran')).toBe('2026-10-05');
    expect(plantDayOf(null, 'UTC')).toBe('');
    expect(plantDayStart('2026-10-02', 'Asia/Tehran')).toBe('2026-10-01T20:30:00.000Z');
    expect(plantDayStart('', 'UTC')).toBeNull();
  });
});

describe('RCA policy draft (SME D17)', () => {
  const policy = {
    id: 'p', unitId: null, version: 2, durationThresholdSeconds: 7200, costThreshold: null, costCurrency: null,
    lostQuantityShareOfDailyPlan: 0.01, repeatCount: 3, repeatWindowDays: 30, repeatMatch: 'asset_and_mode',
    criticalAssets: { criticalities: ['critical'], thresholdFactor: 0.5 }, cumulative: { windowDays: 90, downtimeSeconds: 28800 },
    consequence: { solTypes: ['Safety'], severities: ['Critical'] }, autoCreate: 'recommend',
  } as unknown as RcaPolicyVersion;

  it('round-trips the pilot values', () => {
    expect(inputOf(draftOf(policy), null)).toEqual({
      unitId: null,
      durationThresholdSeconds: 7200,
      repeatCount: 3,
      repeatWindowDays: 30,
      repeatMatch: 'asset_and_mode',
      autoCreate: 'recommend',
      costThreshold: null,
      costCurrency: null,
      lostQuantityShareOfDailyPlan: 0.01,
      criticalAssets: { criticalities: ['critical'], thresholdFactor: 0.5 },
      cumulative: { windowDays: 90, downtimeSeconds: 28800 },
    });
  });

  it('a money limit needs its currency; empty quantity and cumulative switch them off', () => {
    const draft = draftOf(policy);
    expect(inputOf({ ...draft, costThreshold: '5000' }, null)).toBeNull();
    expect(inputOf({ ...draft, costThreshold: '5000', costCurrency: 'USD' }, null)).toMatchObject({ costThreshold: 5000, costCurrency: 'USD' });
    expect(inputOf({ ...draft, lostQuantityPercent: '', cumulativeHours: '', cumulativeDays: '' }, 'u1')).toMatchObject({
      unitId: 'u1',
      lostQuantityShareOfDailyPlan: null,
      cumulative: null,
    });
    expect(inputOf({ ...draft, criticalFactor: '2' }, null)).toBeNull();
  });
});
