import { describe, expect, it } from 'vitest';
import example from '../../../contracts/rca/rca-case-v2.example.json';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { buildActionBody, EMPTY_ACTION_FORM } from './model/action-form';
import { summarizeEvidence } from './model/evidence-summary';
import { recommendationText } from './model/rca-labels';
import { buildCreateBody, buildDefinitionPatch, emptyCaseForm, newItemId, type RcaCaseForm } from './model/rca-form';

describe('RCA case bodies (v2 contract, the verified v1 save bug)', () => {
  it('builds the definition PATCH from the form: declared fields only, empty text as null, days as UTC midnight', () => {
    const form: RcaCaseForm = {
      ...emptyCaseForm(example.unitId),
      title: ` ${example.title} `,
      description: example.description,
      status: 'In Progress',
      priority: 'High',
      teamLeadId: example.teamLeadId,
      teamMemberIds: example.teamMemberIds,
      targetCloseDate: '2026-11-30',
      teamCharter: '  ',
    };
    expect(buildDefinitionPatch(form)).toEqual({
      title: example.title,
      description: example.description,
      status: 'In Progress',
      priority: 'High',
      unitId: example.unitId,
      targetCloseDate: example.targetCloseDate,
      rootCause: null,
      teamCharter: null,
      teamLeadId: example.teamLeadId,
      teamMemberIds: example.teamMemberIds,
    });
  });

  it('never sends the v1 keys the server refused (tenant, organization, teamMembers, legacy dates)', () => {
    const body = buildCreateBody({ ...emptyCaseForm(null), title: 'x' });
    for (const key of ['tenantId', 'organizationId', 'teamMembers', 'targetCompletionDate', 'additionalData', 'startDate']) {
      expect(body).not.toHaveProperty(key);
    }
    expect(body).toMatchObject({ title: 'x', templateId: null, status: 'Draft' });
  });

  it('new item ids do not collide', () => {
    expect(newItemId('rec', [{ id: 'rec-2' }])).toBe('rec-3');
    expect(newItemId('rec', [{ id: 'rec-1' }, { id: 'rec-2' }])).toBe('rec-3');
  });
});

describe('action body and labels', () => {
  it('sends a counted baseline without value and a claim with its currency', () => {
    const body = buildActionBody(
      { ...EMPTY_ACTION_FORM, title: 'Realign', windowStart: '2026-09-01', windowEnd: '2026-09-15', baselineMetric: 'recurrences', claimed: '1000', claimedCurrency: 'USD' },
      'u1',
    );
    expect(body).toMatchObject({
      title: 'Realign',
      ownerId: 'u1',
      verificationWindowStart: '2026-09-01T00:00:00.000Z',
      baseline: { metric: 'recurrences', windowDays: 30 },
      claimedAvoidedLoss: '1000',
      claimedCurrency: 'USD',
    });
    expect(body.baseline).not.toHaveProperty('value');
  });

  it('a recommendation badge names the trigger, its version and the provisional marker', () => {
    const rec = { trigger: 'duration', source: { kind: 'policy', id: 'p', version: 1 }, provisional: true, detail: {} } as unknown as RcaRecommendationView;
    expect(recommendationText(rec)).toBe('Long unplanned stop · RCA policy v1 · provisional (event still open)');
  });

  it('reads an evidence package as stored and tolerates missing parts', () => {
    const summary = summarizeEvidence({
      revisions: [{}, {}],
      causeCodes: { reasonCode: { id: 'r', code: 'BRG', name: 'Bearing' }, failureMode: null },
      recurrence: { windowDays: 90, sameAsset: 2, sameReason: null },
      approvedImpact: { lines: 0, quantities: [], values: [], basis: 'b' },
    });
    expect(summary).toMatchObject({ revisions: 2, reason: 'BRG Bearing', recurrence: { sameAsset: 2, sameReason: null }, trendWindow: null });
    expect(summarizeEvidence(null).approvedImpact).toBeNull();
  });
});
