import { revisionActorSource } from './revision-actor-source';

const derived = { sourceKind: 'derived', source: 'State engine' };
const connector = { sourceKind: 'source', source: 'PI AF frames' };
const manual = { sourceKind: 'manual', source: 'Manual' };

describe('revisionActorSource (owner finding 1: "System (<source>)")', () => {
  it('names nobody for a user revision', () => {
    expect(
      revisionActorSource(
        { actorKind: 'user', kind: 'user', reason: 'state engine x' },
        derived,
      ),
    ).toBeNull();
  });

  it('a derived stop created, reprocessed or retracted by the engine is the state engine', () => {
    for (const kind of ['source', 'retraction', 'coding']) {
      expect(
        revisionActorSource(
          { actorKind: 'system', kind, reason: 'created' },
          derived,
        ),
      ).toBe('state-engine');
    }
    expect(
      revisionActorSource(
        { actorKind: 'system', kind: 'coding', reason: 'baseline' },
        derived,
      ),
    ).toBe('state-engine');
  });

  it('the writer’s own reason names the service, whatever the event origin', () => {
    const at = (reason: string) =>
      revisionActorSource(
        { actorKind: 'system', kind: 'user', reason },
        manual,
      );
    expect(at('state engine: measured reduced-rate fraction')).toBe(
      'state-engine',
    );
    expect(at('unit impact rule v3: partial')).toBe('unit-impact');
    expect(at('Repair: reasonless stop marked uncoded')).toBe('data-repair');
    expect(at('duplicate stop merged automatically (start within 60 s)')).toBe(
      'stop-reconciliation',
    );
  });

  it('a connector or import revision carries the event’s source name', () => {
    expect(
      revisionActorSource(
        { actorKind: 'connector', kind: 'source', reason: null },
        connector,
      ),
    ).toBe('PI AF frames');
    expect(
      revisionActorSource(
        { actorKind: 'connector', kind: 'source', reason: null },
        { sourceKind: 'source', source: null },
      ),
    ).toBe('connector');
    expect(
      revisionActorSource(
        { actorKind: 'system', kind: 'source', reason: 'created' },
        { sourceKind: 'imported', source: 'CSV import' },
      ),
    ).toBe('CSV import');
  });

  it('stays unnamed when nothing recorded says more than "system"', () => {
    expect(
      revisionActorSource(
        { actorKind: 'system', kind: 'system', reason: 'something else' },
        manual,
      ),
    ).toBeNull();
  });
});
