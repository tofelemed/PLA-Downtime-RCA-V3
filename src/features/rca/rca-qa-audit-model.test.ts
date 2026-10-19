import { describe, expect, it } from 'vitest';
import type { RcaActionView, RcaCaseView, RcaLinkView } from '@/api/v2/types/rca';
import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import type { RcaPolicyVersion } from '@/features/event-hub/rca-policy/rca-policy-api';
import { percentError } from '@/features/event-hub/rca-policy/rca-policy-rules-draft';
import { ruleFacts } from '@/features/event-hub/rca-policy/rca-policy-text';
import { effectiveFromText } from '@/features/ux-kit/format/built-in-default';
import { actionsCsv, caseJson, evidenceCsv } from './model/case-export';
import { CLOSED_CASE_NOTICE, workspaceAccess } from './model/closed-case';
import { historyActionLabel, historyActor, historyValueText, visibleChangedFields, type HistoryResolvers } from './model/history-entry';
import { historyExportRow } from './model/history-export';
import { criteriaSourceText, FILTER_STATUSES, linkedEventKind, statusLabel, verificationLabel } from './model/rca-labels';
import { timelineOf } from './model/timeline';

const NAMES = { user: (id: string | null) => (id ? `name:${id}` : '—'), asset: (id: string | null) => (id ? `asset:${id}` : '—'), unit: (id: string | null) => (id ? `unit:${id}` : '—') };

const RESOLVE: HistoryResolvers = {
  user: (id) => `name:${id}`,
  unit: (id) => `unit:${id}`,
  day: (value) => value.slice(0, 10),
  recommendation: () => null,
  causeCode: (id) => (id === 'code-1' ? 'ME-INSPECTION-GAP — Inspection gap' : null),
};

const CASE = {
  id: 'c1', title: 'Gearbox trip', status: 'Closed', priority: 'High', unitId: 'u1', teamLeadId: null, teamMemberIds: [], targetCloseDate: null,
  actualCloseDate: null, description: null, teamCharter: null, rootCause: null, logicTree: [], eventDiagram: { nodes: [], edges: [] },
  recommendations: [{ id: 'r1', title: 'Revise inspection', description: null, priority: 'High', ownerId: 'leila', dueDate: null, status: 'Completed', estimatedCost: null }],
  evidence: [
    {
      id: 'ev-1', title: 'Oil sample', description: null, type: 'Document', source: null, collectedAt: null, collectedBy: null, category: null, location: null,
      occurredAt: '2026-10-17T05:00:00Z', assetId: 'a1', severity: 'High', tags: [], verified: true, fiveP: 'Parts', task: 'Bring the oil report',
      taskDueDate: '2026-10-18', taskStatus: 'completed', taskAssigneeId: 'omid', verifiedBy: 'farid', verifiedAt: null, nodeIds: [], timeSeries: null,
      attachments: [{ fileName: 'f1.png', name: 'oil.png' }, { fileName: 'f2.png', name: 'oil-2.png' }],
    },
  ],
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
} as unknown as RcaCaseView;

const ACTION = {
  id: 'a1', rcaId: 'c1', title: 'Add a lube-oil check', status: 'done', actionType: 'procedure_change', ownerId: 'leila', dueDate: '2026-10-19T20:30:00Z',
  recommendationId: 'r1', completedAt: '2026-10-18T10:00:00Z', verificationStatus: 'evaluated', verdict: 'insufficient_evidence',
  claimedAvoidedLoss: { amount: '4200', currency: 'USD' }, cancelReason: null,
} as unknown as RcaActionView;

const historyEntry = (over: Partial<RcaHistoryEntryView>): RcaHistoryEntryView => ({
  id: 'h1', at: '2026-10-18T18:47:28Z', action: 'rca_case.updated', entityType: 'rca_case', entityId: 'c1', actorId: null, actorName: null,
  service: null, reason: null, revision: 22, changedFields: [], values: {}, beforeHash: null, afterHash: null, detail: {}, ...over,
});

describe('QA H1: a closed investigation is read-only in the workspace', () => {
  it('keeps the writer role (for Reopen) but makes nothing editable', () => {
    expect(workspaceAccess({ status: 'Closed' }, true)).toEqual({ readOnly: true, canWrite: true, closed: true });
    expect(workspaceAccess({ status: 'Monitoring' }, true)).toEqual({ readOnly: false, canWrite: true, closed: false });
    expect(workspaceAccess({ status: 'Draft' }, false)).toEqual({ readOnly: true, canWrite: false, closed: false });
    expect(CLOSED_CASE_NOTICE).toBe('Closed investigation — reopen to change');
  });
});

describe('QA M2: the verification badge never contradicts the verdict', () => {
  it('shows the recorded verdict, not "Verified"', () => {
    expect(verificationLabel({ verificationStatus: 'evaluated', verdict: 'insufficient_evidence' })).toBe('Not enough evidence yet');
    expect(verificationLabel({ verificationStatus: 'evaluated', verdict: 'effective' })).toBe('Effective');
    expect(verificationLabel({ verificationStatus: 'evaluated', verdict: null })).toBe('Verdict recorded');
    expect(verificationLabel({ verificationStatus: 'due', verdict: null })).toBe('Verification due');
  });
});

describe('QA M4: exports', () => {
  it('the JSON carries every analysis tool and the History', () => {
    const history = [historyExportRow(historyEntry({ action: 'rca_case.repaired', service: 'data_repair', reason: 'Data repair: x', changedFields: ['recommendations', 'id'] }), RESOLVE)];
    const analyses = {
      fiveWhy: { id: 'w', rowVersion: 2, updatedAt: '2026-10-18T00:00:00Z', problem: 'Trip', whyLevels: [], rootCause: 'Inspection gap' },
      fishbone: null, fmea: null, faultTree: null, barrier: null, change: null,
    } as never;
    const document = JSON.parse(caseJson(CASE, NAMES, { actions: [], causes: [], links: [], outcome: null, analyses, history }, 'Asia/Tehran')) as Record<string, unknown>;
    expect(document.analyses).toMatchObject({ fiveWhy: { problem: 'Trip', rootCause: 'Inspection gap' }, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null });
    expect((document.analyses as { fiveWhy: Record<string, unknown> }).fiveWhy).not.toHaveProperty('rowVersion');
    expect(document.history).toEqual([{ at: '2026-10-18T18:47:28Z', what: 'Data repair', by: 'System (data repair)', changed: ['recommendations'], values: [], reason: 'Data repair: x' }]);
  });

  it('the actions CSV uses labels, names and the plant day', () => {
    const [header, line] = actionsCsv(CASE, [ACTION], NAMES, 'Asia/Tehran').split('\n');
    expect(header).toBe('"Title","Type","Status","Owner","Due date (Asia/Tehran)","Recommendation","Completed (UTC)","Verification","Claimed avoided loss","Currency","Cancel reason"');
    expect(line).toBe('"Add a lube-oil check","Procedure change","Done","name:leila","2026-10-20","Revise inspection","2026-10-18T10:00:00Z","Not enough evidence yet","4200","USD",""');
  });

  it('the evidence CSV uses display labels, observed time, asset and file count', () => {
    const [header, line] = evidenceCsv(CASE, NAMES, (iso) => `plant:${iso}`).split('\n');
    expect(header).toContain('"Observed (plant time)","Observed (UTC)","Asset"');
    expect(header).toContain('"Request","Requested from","Request status","Request due","Files"');
    expect(header).not.toMatch(/Task/);
    expect(line).toContain('"plant:2026-10-17T05:00:00Z","2026-10-17T05:00:00Z","asset:a1"');
    expect(line).toContain('"Bring the oil report","name:omid","Done","2026-10-18","2"');
    expect(line).not.toContain('completed');
  });
});

describe('QA lows: words', () => {
  it('statuses read in sentence case; the legacy Published value is not offered as a filter', () => {
    expect(statusLabel('In Progress')).toBe('In progress');
    expect(statusLabel('Closure Review')).toBe('Closure review');
    expect(FILTER_STATUSES).not.toContain('Published');
    expect(FILTER_STATUSES).toContain('Closed');
  });

  it('a linked downtime event is a Stop (glossary)', () => {
    expect(linkedEventKind('downtime')).toBe('Stop');
    expect(linkedEventKind('slowdown')).toBe('Slowdown');
    expect(linkedEventKind(undefined)).toBe('Event');
  });

  it('the timeline names a linked stop by kind and reason, never the entity name', () => {
    const link = {
      id: 'l1', linkType: 'event', evidence: { event: { start: '2026-10-17T05:00:00Z', physicalType: 'downtime', eventType: 'ProductionLoss' }, causeCodes: { reasonCode: { name: 'Gearbox failure' } } },
      reason: null,
    } as unknown as RcaLinkView;
    const [entry] = timelineOf([], [link], []);
    expect(entry).toMatchObject({ title: 'Stop · Gearbox failure', type: 'Linked stop' });
  });

  it('the action thresholds name the policy version they were frozen from', () => {
    expect(criteriaSourceText(1)).toBe('Thresholds frozen from RCA policy v1 when the verification was planned.');
    expect(criteriaSourceText(undefined)).toContain('in force when the verification was planned');
  });
});

describe('QA L8 / M1: History', () => {
  it('hides bookkeeping fields and names cause codes', () => {
    expect(visibleChangedFields(['id', 'rcaId', 'tenantId', 'investigatorIds', 'targetId', 'createdBy', 'title', 'causeCodeId'])).toEqual(['title', 'causeCodeId']);
    const cause = historyEntry({ entityType: 'rca_cause' });
    expect(historyValueText(cause, 'causeCodeId', 'code-1', RESOLVE)).toBe('ME-INSPECTION-GAP — Inspection gap');
    expect(historyValueText(cause, 'causeCodeId', 'gone', RESOLVE)).toBe('a removed cause code');
  });

  it('a data repair reads as a system entry', () => {
    const entry = historyEntry({ action: 'rca_case.repaired', service: 'data_repair' });
    expect(historyActionLabel(entry.action)).toBe('Data repair');
    expect(historyActor(entry)).toBe('System (data repair)');
  });
});

describe('QA L9: RCA trigger settings', () => {
  const policy = {
    effectiveness: { baselineLookbackDays: 90, minExposureHours: 600, requiredReduction: 0.5, reviewDays: 90, zeroRepeatClasses: [], minimumCoverage: 0.95 },
    fmea: { method: 'rpn', rpnThreshold: 100, severityReview: 9, priorityRules: [] },
    fiveWhy: { guidelineLevels: 5, minLevels: 3, evidencePerLevel: true, unsupportedRootCauses: ['operator error'] },
    investigation: { minor: { methodGroups: [['five_why', 'fishbone', 'logic_tree']], minTeamMembers: 1 } },
  } as unknown as RcaPolicyVersion;

  it('the read-only summary shows the coverage minimum and method names', () => {
    const facts = ruleFacts(policy);
    expect(facts.find((fact) => fact.label === 'Effectiveness')?.value).toContain('at least 95.0 % state-data coverage');
    const methods = facts.find((fact) => fact.label === 'Methods by consequence')?.value ?? '';
    expect(methods).toBe('Minor: 5-Why or Fishbone or Logic tree (team ≥ 1)');
    expect(methods).not.toMatch(/five_why|logic_tree/);
  });

  it('the seeded first version reads "Built-in default"; an out-of-range percent says why', () => {
    expect(effectiveFromText('1970-01-01T00:00:00Z', () => '1970-01-01 03:30')).toMatch(/^Built-in default/);
    expect(percentError('150', true)).toBe('Enter a percentage from 0 to 100.');
    expect(percentError('95', true)).toBeNull();
  });
});
