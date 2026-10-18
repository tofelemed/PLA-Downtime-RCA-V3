import { EntityManager } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { RevisionState } from '../../reconciliation/revision-state';
import {
  loadEventRca,
  rcaEventIdsOf,
  withCandidateRca,
  withLinkedEventRca,
} from './event-rca';
import {
  CandidateV2View,
  ReconciliationLineV2View,
} from './reconciliation-v2.view';

const T = '00000000-0000-4000-8000-0000000000aa';

describe('event RCA of loss lines (UX G-4)', () => {
  it('collects cause events of candidates and events cited by saved lines, once each', () => {
    const state = {
      candidateLines: [
        { causeEventId: 'e1' },
        { causeEventId: null },
        { causeEventId: 'e1' },
      ],
      lines: [{ evidence: [{ eventId: 'e2' }, { eventId: 'e1' }] }],
    } as unknown as RevisionState;
    expect(rcaEventIdsOf(state)).toEqual(['e1', 'e2']);
  });

  it('loads the events RCA state and investigation with one tenant-scoped query', async () => {
    const find = jest.fn(() =>
      Promise.resolve([
        { id: 'e1', rcaState: 'linked', rcaId: 'case-1' },
        { id: 'e2', rcaState: 'required', rcaId: null },
      ]),
    );
    const manager = { find } as unknown as EntityManager;
    const result = await loadEventRca(manager, T, ['e1', 'e2']);
    expect(find).toHaveBeenCalledTimes(1);
    const [entity, options] = find.mock.calls[0] as unknown as [
      unknown,
      { select: unknown; where: { tenantId: string } },
    ];
    expect(entity).toBe(ProductionEvent);
    expect(options.select).toEqual({ id: true, rcaState: true, rcaId: true });
    expect(options.where.tenantId).toBe(T);
    expect(result.get('e1')).toEqual({ state: 'linked', caseId: 'case-1' });
    expect(result.get('e2')).toEqual({ state: 'required', caseId: null });
  });

  it('runs no query without events', async () => {
    const find = jest.fn();
    const manager = { find } as unknown as EntityManager;
    expect((await loadEventRca(manager, T, [])).size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('attaches the cause event RCA to candidates (null when the event is not found)', () => {
    const rca = new Map([['e1', { state: 'completed', caseId: 'c1' }]]);
    const candidates = [
      { lossLineId: 'l1', causeEventId: 'e1' },
      { lossLineId: 'l2', causeEventId: 'gone' },
      { lossLineId: 'l3', causeEventId: null },
    ] as CandidateV2View[];
    const [found, missing, none] = withCandidateRca(candidates, rca);
    expect(found.causeEventRca).toEqual({ state: 'completed', caseId: 'c1' });
    expect(missing.causeEventRca).toBeNull();
    expect(none).not.toHaveProperty('causeEventRca');
  });

  it('lists the RCA of the events a saved line cites', () => {
    const rca = new Map([['e2', { state: 'required', caseId: null }]]);
    const lines = [
      { id: 'm1', evidence: [{ eventId: 'e2' }, { eventId: 'gone' }] },
      { id: 'm2', evidence: [] },
    ] as unknown as ReconciliationLineV2View[];
    const [cited, empty] = withLinkedEventRca(lines, rca);
    expect(cited.linkedEventRca).toEqual([
      { eventId: 'e2', state: 'required', caseId: null },
    ]);
    expect(empty).not.toHaveProperty('linkedEventRca');
  });
});
