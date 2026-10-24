import { describe, expect, it } from 'vitest';
import type { RcaAnalysesView } from '@/api/v2/types/rca-analyses';
import type { RcaCaseView, RcaEvidenceItem, RcaLinkView, RcaLogicNode } from '@/api/v2/types/rca';
import { addLevel, depthGuidance, fiveWhyChecks, removeLevel, setAnswer } from './case/analysis/tools/five-why/five-why-model';
import { toolOf, toolStatus } from './model/analysis-tools';
import { filtersFromParams, legacyRedirect, paramsFromFilters, toCaseQuery } from './model/case-filters';
import { EMPTY_EVIDENCE_FORM, evidenceFormOf, evidenceItemOf } from './model/evidence-form';
import { buildTree, newNode, removeSubtree, toggleEvidenceLink, treeCounts } from './model/logic-tree';
import { isCostValid, recommendationFormOf, recommendationItemOf, EMPTY_RECOMMENDATION_FORM } from './model/recommendation-form';
import { timelineOf } from './model/timeline';

const node = (id: string, parentId: string | null, extra: Partial<RcaLogicNode> = {}): RcaLogicNode => ({
  id,
  parentId,
  label: id,
  kind: null,
  status: 'open',
  notes: null,
  code: null,
  description: null,
  verified: null,
  ...extra,
});

const base = { id: 'ev-1', collectedAt: '2026-10-01T00:00:00Z', collectedBy: null, nodeIds: ['n1'], verifiedBy: null, verifiedAt: null };

describe('case list filters', () => {
  it('round-trips the URL and builds the server query (nothing filtered in the browser)', () => {
    const filters = filtersFromParams(new URLSearchParams('q=pump&status=Draft&priority=Bogus&due=overdue'));
    expect(filters).toEqual({ q: 'pump', status: 'Draft', priority: 'all', due: 'overdue', open: 'all' });
    expect(paramsFromFilters(filters)).toEqual({ q: 'pump', status: 'Draft', due: 'overdue' });
    expect(toCaseQuery(filters)).toEqual({ q: 'pump', status: 'Draft', priority: undefined, overdue: true, open: undefined });
  });

  it('sends old links to the routes that replaced them', () => {
    expect(legacyRedirect(new URLSearchParams('case=c1'))).toBe('/rca/c1');
    expect(legacyRedirect(new URLSearchParams('rca=c2'))).toBe('/rca/c2');
    expect(legacyRedirect(new URLSearchParams('eventId=e1&eventTitle=x'))).toBe('/rca/new?eventId=e1');
    expect(legacyRedirect(new URLSearchParams('q=x'))).toBeNull();
  });
});

describe('evidence and recommendation forms', () => {
  it('keeps links and provenance of an edited item and only sends a series for time-series evidence', () => {
    const item = evidenceItemOf({ ...EMPTY_EVIDENCE_FORM, title: ' Photo ', tags: 'a, ,b', type: 'Photo' }, base);
    expect(item).toMatchObject({ id: 'ev-1', title: 'Photo', tags: ['a', 'b'], nodeIds: ['n1'], timeSeries: null, collectedAt: base.collectedAt });
    const series = evidenceItemOf({ ...EMPTY_EVIDENCE_FORM, title: 'Trend', type: 'Time Series', series: { ...EMPTY_EVIDENCE_FORM.series, streams: 'P101.VIB', intervals: 'x' } }, base);
    expect(series.timeSeries).toMatchObject({ provider: 'pi', streams: 'P101.VIB', intervals: null });
    expect(evidenceFormOf(item as RcaEvidenceItem, 'UTC').tags).toBe('a, b');
    const due = { ...(item as RcaEvidenceItem), taskDueDate: '2026-10-01T20:30:00.000Z' };
    expect(evidenceFormOf(due, 'Asia/Tehran').taskDueDate).toBe('2026-10-02');
    expect(evidenceFormOf({ ...due, taskDueDate: '2026-10-05' }, 'Asia/Tehran').taskDueDate).toBe('2026-10-05');
  });

  it('validates the estimated cost as a plain decimal and stores the due day at the plant day start', () => {
    expect(isCostValid('1250.50')).toBe(true);
    expect(isCostValid('$12')).toBe(false);
    const rec = recommendationItemOf({ ...EMPTY_RECOMMENDATION_FORM, title: 'Fix', dueDate: '2026-11-01', estimatedCost: ' ' }, 'rec-1', 'UTC');
    expect(rec).toMatchObject({ dueDate: '2026-11-01T00:00:00.000Z', estimatedCost: null, ownerId: null });
    const tehran = recommendationItemOf({ ...EMPTY_RECOMMENDATION_FORM, title: 'Fix', dueDate: '2026-11-01' }, 'rec-1', 'Asia/Tehran');
    expect(tehran.dueDate).toBe('2026-10-31T20:30:00.000Z');
    // FE-10 family: the stored instant reads back as the plant's day, never its UTC day
    expect(recommendationFormOf(tehran, 'Asia/Tehran').dueDate).toBe('2026-11-01');
  });
});

describe('logic tree', () => {
  const nodes = [node('a', null), node('b', 'a', { kind: 'Cause', verified: true }), node('c', 'b'), node('d', 'missing')];

  it('builds the tree; an orphan becomes a root and a delete takes the subtree', () => {
    expect(buildTree(nodes).map((t) => t.node.id)).toEqual(['a', 'd']);
    expect(removeSubtree(nodes, 'b').map((n) => n.id)).toEqual(['a', 'd']);
    expect(newNode(nodes, 'a', { label: 'x' })).toMatchObject({ parentId: 'a', label: 'x', status: 'open' });
  });

  it('counts nodes, verified findings, root causes and evidence linked to a node', () => {
    const evidence = [{ ...evidenceItemOf({ ...EMPTY_EVIDENCE_FORM, title: 'e' }, { ...base, nodeIds: ['c'] }) }];
    expect(treeCounts(nodes, evidence)).toEqual({ nodes: 4, verified: 1, rootCauses: 1, linkedEvidence: 1 });
    expect(toggleEvidenceLink(evidence, 'ev-1', 'a', true)[0].nodeIds).toEqual(['c', 'a']);
    expect(toggleEvidenceLink(evidence, 'ev-1', 'c', false)[0].nodeIds).toEqual([]);
  });
});

describe('5-Why and timeline', () => {
  it('asks each new why about the previous answer and renumbers on removal', () => {
    let levels = [{ level: 1, question: 'Why?', answer: 'Seal leak', justification: '' }];
    levels = addLevel(levels);
    expect(levels[1].question).toBe('Why did "Seal leak" happen?');
    levels = setAnswer(levels, 0, 'Pump trip');
    expect(levels[1].question).toBe('Why did "Pump trip" happen?');
    expect(removeLevel(levels, 0).map((l) => l.level)).toEqual([1]);
    const checks = fiveWhyChecks({ problem: 'x', whyLevels: levels, rootCause: '' });
    // CA6: depth is guidance, not a check; evidence and the root cause are
    expect(checks.map((c) => c.label)).not.toContain(expect.stringContaining('At least'));
    expect(checks.find((c) => c.label.startsWith('Every answer backed'))?.done).toBe(false);
    expect(depthGuidance(3, 5)).toContain('3 of the 5 levels of the guideline');
  });

  it('does not tick the system-level root cause for a phrase the gate refuses (CA6, Marun RCA test)', () => {
    const answered = [{ level: 1, question: 'Why?', answer: 'Gearbox tripped', justification: 'trip record' }];
    const rootCauseCheck = (rootCause: string) =>
      fiveWhyChecks({ problem: 'x', whyLevels: answered, rootCause }, ['operator error']).find((c) => c.label.startsWith('System-level'))?.done;
    expect(rootCauseCheck('Operator error')).toBe(false);
    expect(rootCauseCheck('  operator   ERROR. ')).toBe(false);
    expect(rootCauseCheck('The inspection process failed to detect progressive lubrication contamination')).toBe(true);
  });

  it('orders diagram events and linked events by time; undated last', () => {
    const link = { id: 'l1', linkType: 'event', reason: null, evidence: { event: { start: '2026-10-01T05:00:00Z', physicalType: 'downtime' } } } as unknown as RcaLinkView;
    const entries = timelineOf(
      [
        { id: 'e1', label: 'Alarm', type: 'Alarm', timestamp: '2026-10-01T06:00:00Z', description: null, asset: null, severity: null, position: { x: 0, y: 0 } },
        { id: 'e2', label: 'Note', type: 'Note', timestamp: null, description: null, asset: null, severity: null, position: { x: 0, y: 0 } },
      ],
      [link],
      [],
    );
    expect(entries.map((e) => e.id)).toEqual(['l1', 'e1', 'e2']);
  });
});

describe('analysis index status (kind, not display words)', () => {
  const rca = (logicTree: number, events: number) =>
    ({
      logicTree: Array.from({ length: logicTree }, (_, i) => node(`n${i}`, null)),
      eventDiagram: { nodes: Array.from({ length: events }, (_, i) => ({ id: `e${i}` })), edges: [] },
    }) as unknown as RcaCaseView;
  const tool = (slug: string) => toolOf(slug)!;
  const none = { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null } as unknown as RcaAnalysesView;

  it('counts the case-stored tools and reads the record tools from the analyses', () => {
    expect(toolStatus(tool('logic-tree'), rca(3, 0), undefined)).toEqual({ kind: 'started', text: '3 nodes' });
    expect(toolStatus(tool('logic-tree'), rca(0, 0), undefined)).toEqual({ kind: 'not_started', text: 'Not started' });
    expect(toolStatus(tool('timeline'), rca(0, 1), undefined)).toEqual({ kind: 'started', text: '1 event' });
    expect(toolStatus(tool('five-why'), rca(0, 0), undefined)).toEqual({ kind: 'loading', text: '…' });
    expect(toolStatus(tool('five-why'), rca(0, 0), none)).toEqual({ kind: 'not_started', text: 'Not started' });
    expect(toolStatus(tool('fmea'), rca(0, 0), { ...none, fmea: {} } as unknown as RcaAnalysesView)).toEqual({ kind: 'started', text: 'Saved' });
  });
});
