import { describe, expect, it } from 'vitest';
import type { FaultTreeNode } from '@/api/v2/types/rca-analyses';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { rcaStateOfTrigger } from './bad-actors/bad-actor-model';
import { buildFaultTree, faultSubtreeIds } from './case/analysis/tools/fault-tree/fault-tree-model';
import { addConnection, canConnect } from './case/analysis/tools/event-diagram/diagram-model';
import { isVersionConflict } from './case/analysis/tools/use-tool-frame';
import { actionEditFormOf, buildActionEditPatch } from './model/action-edit';
import { EMPTY_CASE_FILTERS, filtersOfChip, isChipActive } from './model/case-filters';
import { CASE_STAGES, stageIndexOf, stageStateOf } from './model/case-stages';
import { triggerLinkOf } from './model/case-trace';
import { draftText } from './model/draft-text';
import { isActionOverdue, isEvidenceTaskOverdue, isPastPlantDay } from './model/due-date';
import { V2ApiError } from '@/api/v2/errors';

const NOW = new Date('2026-10-18T10:00:00Z');

describe('due days (A-8, F-11)', () => {
  it('compares plant calendar days, not instants', () => {
    expect(isPastPlantDay('2026-10-17', 'UTC', NOW)).toBe(true);
    expect(isPastPlantDay('2026-10-18', 'UTC', NOW)).toBe(false);
    // 2026-10-17T20:30Z is already 18 October in Tehran (UTC+3:30): due today, not overdue
    expect(isPastPlantDay('2026-10-17T20:30:00.000Z', 'Asia/Tehran', NOW)).toBe(false);
    expect(isPastPlantDay(null, 'UTC', NOW)).toBe(false);
  });

  it('an action is overdue only while it is neither done nor cancelled', () => {
    const due = '2026-10-01T00:00:00.000Z';
    expect(isActionOverdue({ dueDate: due, status: 'open' }, 'UTC', NOW)).toBe(true);
    expect(isActionOverdue({ dueDate: due, status: 'in_progress' }, 'UTC', NOW)).toBe(true);
    expect(isActionOverdue({ dueDate: due, status: 'done' }, 'UTC', NOW)).toBe(false);
    expect(isActionOverdue({ dueDate: due, status: 'cancelled' }, 'UTC', NOW)).toBe(false);
    expect(isActionOverdue({ dueDate: null, status: 'open' }, 'UTC', NOW)).toBe(false);
  });

  it('an evidence task is overdue until it is completed', () => {
    expect(isEvidenceTaskOverdue({ taskDueDate: '2026-10-01T00:00:00.000Z', taskStatus: 'pending' }, 'UTC', NOW)).toBe(true);
    expect(isEvidenceTaskOverdue({ taskDueDate: '2026-10-01T00:00:00.000Z', taskStatus: 'completed' }, 'UTC', NOW)).toBe(false);
  });
});

describe('action edit patch (A-8)', () => {
  const action = { title: 'Realign', ownerId: 'u1', dueDate: '2026-10-20T00:00:00.000Z', verificationWindowStart: null, verificationWindowEnd: null };

  it('sends only the fields that changed, days as the instant the plant day starts', () => {
    const form = actionEditFormOf(action, 'UTC');
    expect(form).toEqual({ title: 'Realign', ownerId: 'u1', dueDate: '2026-10-20', windowStart: '', windowEnd: '', recommendationId: '', verificationMethod: '', verifierId: '' });
    expect(buildActionEditPatch(form, action, 'UTC')).toEqual({});
    expect(buildActionEditPatch({ ...form, title: ' Realign coupling ', ownerId: 'u2' }, action, 'UTC')).toEqual({ title: 'Realign coupling', ownerId: 'u2' });
    expect(buildActionEditPatch({ ...form, ownerId: '', dueDate: '', windowStart: '2026-11-01' }, action, 'UTC')).toEqual({
      ownerId: null,
      dueDate: null,
      verificationWindowStart: '2026-11-01T00:00:00.000Z',
    });
  });
});

describe('case list chips (F-12)', () => {
  it('maps each count to the server filter it shows and marks the active one', () => {
    expect(filtersOfChip({ kind: 'status', status: 'Analysis' })).toEqual({ ...EMPTY_CASE_FILTERS, status: 'Analysis' });
    expect(filtersOfChip({ kind: 'overdue' }).due).toBe('overdue');
    expect(filtersOfChip({ kind: 'critical' }).priority).toBe('Critical');
    expect(isChipActive({ kind: 'all' }, EMPTY_CASE_FILTERS)).toBe(true);
    expect(isChipActive({ kind: 'overdue' }, { ...EMPTY_CASE_FILTERS, due: 'overdue', q: 'pump' })).toBe(false);
  });
});

describe('status stepper (F-4)', () => {
  it('places every status, Published as analysis, and no status as draft', () => {
    expect(CASE_STAGES).toHaveLength(6);
    expect(stageIndexOf(null)).toBe(0);
    expect(stageIndexOf('Published')).toBe(stageIndexOf('Analysis'));
    expect(stageIndexOf('Closed')).toBe(5);
    expect([0, 1, 2].map((index) => stageStateOf(index, 1))).toEqual(['done', 'current', 'upcoming']);
  });
});

describe('case trace (G-3)', () => {
  const link = (id: string, linkType: RcaLinkView['linkType'], linkedAt: string) => ({ id, linkType, linkedAt, targetId: `t-${id}` }) as RcaLinkView;

  it('the trigger is the first event linked; other events are counted', () => {
    const result = triggerLinkOf([link('b', 'event', '2026-10-02T00:00:00Z'), link('w', 'work_order', '2026-09-01T00:00:00Z'), link('a', 'event', '2026-10-01T00:00:00Z')]);
    expect(result.trigger?.id).toBe('a');
    expect(result.others).toBe(1);
    expect(triggerLinkOf([]).trigger).toBeNull();
  });
});

describe('fault tree as a tree (F-10)', () => {
  const node = (id: string, parentId: string | null): FaultTreeNode => ({ id, parentId, type: 'BasicEvent', description: id, probability: null });

  it('nests children under their parent and keeps the list position', () => {
    const tree = buildFaultTree([node('gate', null), node('seal', 'gate'), node('pump', null)]);
    expect(tree.map((item) => item.node.id)).toEqual(['gate', 'pump']);
    expect(tree[0].children.map((item) => [item.node.id, item.index])).toEqual([['seal', 1]]);
  });

  it('shows nodes of a loop or with a missing parent at the top instead of hiding them', () => {
    const tree = buildFaultTree([node('a', 'b'), node('b', 'a'), node('c', 'gone')]);
    expect(tree.map((item) => item.node.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('a node cannot move under itself or its descendants', () => {
    expect([...faultSubtreeIds([node('a', null), node('b', 'a'), node('c', 'b'), node('d', null)], 'a')].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('event diagram connections (F-10)', () => {
  const diagram = {
    nodes: ['n1', 'n2'].map((id) => ({ id, label: id, type: null, timestamp: null, description: null, asset: null, severity: null, position: { x: 0, y: 0 } })),
    edges: [{ id: 'edge-n1-n2', source: 'n1', target: 'n2' }],
  };

  it('adds a connection once, between two different events', () => {
    expect(canConnect(diagram, 'n1', 'n1')).toBe(false);
    expect(canConnect(diagram, 'n1', 'n2')).toBe(false);
    expect(addConnection(diagram, 'n2', 'n1').edges).toContainEqual({ id: 'edge-n2-n1', source: 'n2', target: 'n1' });
    expect(addConnection(diagram, 'n1', 'n2')).toBe(diagram);
  });
});

describe('unsaved tool text and conflicts (F-6)', () => {
  it('keeps the typed words, without ids', () => {
    expect(draftText({ problem: 'Trips', whyLevels: [{ level: 1, question: 'Why?', answer: 'Seal', id: 'x' }], parentId: 'p' })).toBe('Problem: Trips\nQuestion: Why?\nAnswer: Seal');
  });

  it('a stale version is a conflict, other refusals are not', () => {
    expect(isVersionConflict(new V2ApiError(412, { code: 'VERSION_CONFLICT', message: 'changed', correlationId: null, retryable: false }))).toBe(true);
    expect(isVersionConflict(new V2ApiError(422, { code: 'VALIDATION_FAILED', message: 'bad', correlationId: null, retryable: false }))).toBe(false);
  });
});

describe('bad-actor RCA chip state (G-4)', () => {
  it('a case is linked; an open recommendation is required; otherwise none', () => {
    expect(rcaStateOfTrigger({ rcaId: 'c1', outcome: 'recommended' })).toBe('linked');
    expect(rcaStateOfTrigger({ rcaId: null, outcome: 'recommended' })).toBe('required');
    expect(rcaStateOfTrigger({ rcaId: null, outcome: null })).toBe('none');
  });
});
