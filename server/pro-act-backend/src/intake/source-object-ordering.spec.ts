import * as fc from 'fast-check';
import {
  decideOrdering,
  IncomingVersion,
  StoredVersion,
} from './source-object-ordering';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 8, 6, minute));
const version = (
  hash: string,
  minute: number,
  revision: string | null = null,
): IncomingVersion => ({ hash, observedAt: at(minute), revision });

/** Applies a delivery sequence the way IntakeService does and returns the final stored version. */
function settle(deliveries: readonly IncomingVersion[]): StoredVersion | null {
  let stored: StoredVersion | null = null;
  for (const delivery of deliveries) {
    const decision = decideOrdering(stored, delivery);
    if (decision === 'accepted' || decision === 'revision') stored = delivery;
  }
  return stored;
}

describe('decideOrdering (plan 1.5, spec §5.1 / ING01 / FND04)', () => {
  it.each([
    ['first version', null, version('a', 0), 'accepted'],
    ['same content', version('a', 0), version('a', 5), 'duplicate_content'],
    ['newer observation', version('a', 0), version('b', 5), 'revision'],
    [
      'older observation (out of order)',
      version('b', 5),
      version('a', 0),
      'stale',
    ],
    ['tie, no revisions', version('a', 0), version('b', 0), 'conflict'],
    [
      'tie, text revisions',
      version('a', 0, 'x'),
      version('b', 0, 'y'),
      'conflict',
    ],
    [
      'tie, equal numeric revisions',
      version('a', 0, '7'),
      version('b', 0, '7'),
      'conflict',
    ],
    [
      'tie, higher sequence',
      version('a', 0, '7'),
      version('b', 0, '12'),
      'revision',
    ],
    [
      'tie, lower sequence',
      version('a', 0, '12'),
      version('b', 0, '7'),
      'stale',
    ],
  ] as const)('%s → %s', (_label, stored, incoming, expected) => {
    expect(decideOrdering(stored, incoming)).toBe(expected);
  });

  it('property: any delivery order with duplicates settles on the newest version', () => {
    const versions = fc
      .uniqueArray(fc.integer({ min: 0, max: 10_000 }), {
        minLength: 1,
        maxLength: 8,
      })
      .map((minutes) =>
        minutes.map((minute, index) => version(`h${index}`, minute)),
      );
    fc.assert(
      fc.property(
        versions.chain((list) =>
          fc.tuple(
            fc.constant(list),
            fc.shuffledSubarray(
              list.flatMap((entry) => [entry, entry]),
              { minLength: list.length * 2 },
            ),
          ),
        ),
        ([list, deliveries]) => {
          const newest = list.reduce((a, b) =>
            a.observedAt > b.observedAt ? a : b,
          );
          expect(settle(deliveries)).toEqual(newest);
        },
      ),
      { numRuns: 300 },
    );
  });
});
