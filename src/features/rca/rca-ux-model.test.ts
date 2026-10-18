import { describe, expect, it } from 'vitest';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { applyByDefault, levelHasText } from './case/analysis/tools/five-why/five-why-model';
import { progressSteps } from './model/case-progress';
import { moveConfirmation, workflowMoves } from './model/case-workflow';
import { eventCaseProblem, eventCaseTitle, type EventCaseFacts } from './model/event-case-prefill';

const FACTS: EventCaseFacts = {
  unitName: 'Unit 100',
  assetName: 'Extruder E-1',
  reasonName: 'Die plate blockage',
  start: '2026-10-15 22:39',
  end: '2026-10-18 09:43',
  duration: '59 h 4 min',
};

describe('event case prefill (F-2)', () => {
  it('titles the case with unit, reason and plant start', () => {
    expect(eventCaseTitle(FACTS)).toBe('Unit 100 · Die plate blockage · 2026-10-15 22:39');
    expect(eventCaseTitle({ ...FACTS, reasonName: null })).toBe('Unit 100 · Stop · 2026-10-15 22:39');
  });

  it('states the problem from the facts, ongoing when the stop has no end', () => {
    expect(eventCaseProblem(FACTS)).toBe(
      'Stop on Unit 100, Extruder E-1 from 2026-10-15 22:39 to 2026-10-18 09:43, 59 h 4 min. Reason recorded: Die plate blockage.',
    );
    expect(eventCaseProblem({ ...FACTS, assetName: null, end: null, duration: null, reasonName: null })).toBe(
      'Stop on Unit 100 since 2026-10-15 22:39 (ongoing). No reason recorded yet.',
    );
  });
});

describe('workflow confirmations (F-5)', () => {
  const movesOf = (status: string, next: Array<{ to: string; gates: string[] }>) =>
    workflowMoves({ status, next } as Parameters<typeof workflowMoves>[0]);

  it('confirms accepting, requesting and approving closure with their consequences', () => {
    const [accept] = movesOf('Analysis', [{ to: 'Monitoring', gates: ['investigation'] }]);
    expect(moveConfirmation(accept, 'Analysis')?.description).toMatch(/team is locked/);
    const [request] = movesOf('Monitoring', [{ to: 'Closure Review', gates: ['closure_request'] }]);
    expect(moveConfirmation(request, 'Monitoring')?.description).toMatch(/verdict is frozen/);
    const [reject, approve] = movesOf('Closure Review', [
      { to: 'Monitoring', gates: ['independent_approval', 'note'] },
      { to: 'Closed', gates: ['independent_approval'] },
    ]);
    expect(moveConfirmation(approve, 'Closure Review')?.description).toMatch(/RCA state of its linked events becomes completed/);
    expect(moveConfirmation(reject, 'Closure Review')).toBeNull();
  });

  it('runs other moves at once', () => {
    const [start] = movesOf('Draft', [{ to: 'In Progress', gates: [] }]);
    expect(moveConfirmation(start, 'Draft')).toBeNull();
  });
});

describe('overview progress counts actions (F-3 default)', () => {
  const rca = { evidence: [], logicTree: [], teamMemberIds: [], recommendations: [], status: 'Monitoring' } as unknown as RcaCaseView;
  const actionsStep = (actions: Parameters<typeof progressSteps>[2]) => progressSteps(rca, false, actions).find((step) => step.key === 'actions');

  it('is done when every action not cancelled is done', () => {
    expect(actionsStep([{ status: 'done' }, { status: 'cancelled' }])).toMatchObject({ label: 'Actions', done: true, hint: '1 action(s), 1 done.' });
    expect(actionsStep([{ status: 'done' }, { status: 'open' }])?.done).toBe(false);
    expect(actionsStep([])?.done).toBe(false);
  });

  it('says when the actions are loading or failed', () => {
    expect(actionsStep(undefined)?.hint).toMatch(/Loading/);
    expect(actionsStep('error')?.hint).toMatch(/could not be loaded/);
  });
});

describe('5-Why root cause (F-8, F-9)', () => {
  it('copies the root cause by default only when it cannot overwrite another one', () => {
    expect(applyByDefault(null, undefined)).toBe(true);
    expect(applyByDefault('Seal', 'Seal')).toBe(true);
    expect(applyByDefault('Bearing wear', 'Seal')).toBe(false);
  });

  it('asks before removing a level only when it holds text', () => {
    expect(levelHasText({ level: 2, question: 'q', answer: '', justification: ' ' })).toBe(false);
    expect(levelHasText({ level: 2, question: 'q', answer: 'Seal leak', justification: '' })).toBe(true);
  });
});
