import { describe, expect, it } from 'vitest';
import example from '../../../contracts/rca/rca-case-v2.example.json';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { buildActionBody, buildCompletionPatch, completionFormOf, EMPTY_ACTION_FORM } from './model/action-form';
import { summarizeEvidence } from './model/evidence-summary';
import { recommendationText } from './model/rca-labels';
import { buildCreateBody, buildDefinitionPatch, emptyCaseForm, newItemId, type RcaCaseForm } from './model/rca-form';

describe('RCA case bodies (v2 contract, the verified v1 save bug)', () => {
  it('builds the definition PATCH from the form: declared fields only, never the status, days at the plant day start', () => {
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
      consequenceClass: 'significant',
    };
    expect(buildDefinitionPatch(form, 'UTC')).toEqual({
      title: example.title,
      description: example.description,
      consequenceClass: 'significant',
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
    const body = buildCreateBody({ ...emptyCaseForm(null), title: 'x' }, 'UTC');
    for (const key of ['tenantId', 'organizationId', 'teamMembers', 'targetCompletionDate', 'additionalData', 'startDate']) {
      expect(body).not.toHaveProperty(key);
    }
    expect(body).toMatchObject({ title: 'x', templateId: null, status: 'Draft' });
    // RCA-01: a case opens as Draft or In Progress only
    expect(buildCreateBody({ ...emptyCaseForm(null), title: 'x', status: 'Closed' }, 'UTC').status).toBe('Draft');
  });

  it('a plant calendar day starts at plant midnight (Tehran: 20:30 UTC the day before)', () => {
    const patch = buildDefinitionPatch({ ...emptyCaseForm(null), title: 'x', targetCloseDate: '2026-11-30' }, 'Asia/Tehran');
    expect(patch.targetCloseDate).toBe('2026-11-29T20:30:00.000Z');
  });

  it('new item ids do not collide', () => {
    expect(newItemId('rec', [{ id: 'rec-2' }])).toBe('rec-3');
    expect(newItemId('rec', [{ id: 'rec-1' }, { id: 'rec-2' }])).toBe('rec-3');
  });
});

describe('action body and labels', () => {
  it('sends a counted baseline without value (CA3), its type and a claim with its currency', () => {
    const body = buildActionBody(
      { ...EMPTY_ACTION_FORM, title: 'Realign', actionType: 'repair', windowStart: '2026-09-01', windowEnd: '2026-09-15', baselineMetric: 'recurrences', claimed: '1000', claimedCurrency: 'USD', ownerId: 'u1' },
      'UTC',
    );
    expect(body).toMatchObject({
      title: 'Realign',
      ownerId: 'u1',
      actionType: 'repair',
      verificationWindowStart: '2026-09-01T00:00:00.000Z',
      baseline: { metric: 'recurrences' },
      claimedAvoidedLoss: '1000',
      claimedCurrency: 'USD',
    });
    expect(body.baseline).not.toHaveProperty('value');
    expect(body.baseline).not.toHaveProperty('windowDays');
    const days = buildActionBody({ ...EMPTY_ACTION_FORM, title: 'x', baselineMetric: 'recurrences', baselineDays: '60' }, 'UTC');
    expect(days.ownerId).toBeNull();
    expect(days.baseline).toEqual({ metric: 'recurrences', windowDays: 60 });
  });

  it('CA4: the completion patch sends type, evidence, files and the plant day; done only when asked', () => {
    const form = completionFormOf(
      { actionType: null, completionEvidenceRef: null, completedAt: '2026-10-01T20:30:00.000Z', completionAttachments: [] },
      'Asia/Tehran',
    );
    expect(form.completedAt).toBe('2026-10-02');
    const patch = buildCompletionPatch({ ...form, actionType: 'repair', evidenceRef: ' WO-1 ' }, true, 'Asia/Tehran');
    expect(patch).toEqual({
      actionType: 'repair',
      completionEvidenceRef: 'WO-1',
      completionAttachments: [],
      completedAt: '2026-10-01T20:30:00.000Z',
      status: 'done',
    });
    expect(buildCompletionPatch({ ...form, completedAt: '' }, false, 'UTC')).not.toHaveProperty('status');
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
