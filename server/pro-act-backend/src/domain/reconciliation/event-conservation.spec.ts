import { Dec } from '../actuals/decimal';
import {
  ClaimLine,
  EventCandidate,
  eventConservationIssues,
} from './event-conservation';
import { CandidateOutcome } from './reconciliation.types';

const d = (value: number) => new Dec(value);
const epsilon = d(0.001);

const candidate = (
  autoKey: string,
  eventId: string | null,
  quantity: number,
): EventCandidate => ({
  autoKey,
  eventId,
  kind: 'availability',
  quantity: d(quantity),
});

const proposed = (c: EventCandidate): CandidateOutcome => ({
  autoKey: c.autoKey,
  sliceId: 's1',
  state: 'proposed',
  effectiveQuantity: c.quantity,
});

const manual = (quantity: number, eventIds: string[]): ClaimLine => ({
  action: 'manual',
  autoKey: null,
  sliceId: 's1',
  kind: 'availability',
  quantity: d(quantity),
  eventIds,
});

describe('event-level conservation (SME R10, RC-04)', () => {
  it('a manual line may claim what is left of the event loss in this period, not more', () => {
    // shift B holds 40 t of a 60 t event; the run already proposes 25 t of it
    const candidates = [candidate('k1', 'e1', 40)];
    const outcomes = [
      {
        ...proposed(candidates[0]),
        effectiveQuantity: d(25),
        state: 'adjusted' as const,
      },
    ];
    const ok = eventConservationIssues({
      candidates,
      outcomes,
      lines: [manual(15, ['e1'])],
      epsilon,
    });
    expect(ok).toEqual([]);
    const over = eventConservationIssues({
      candidates,
      outcomes,
      lines: [manual(10, ['e1']), manual(15, ['e1'])],
      epsilon,
    });
    expect(over).toEqual([
      expect.objectContaining({
        code: 'EVENT_OVER_ALLOCATED',
        line: 1,
        expectedRemainingAllocation: '5',
      }),
    ]);
  });

  it('a proposed candidate keeps its whole loss; a rejected one frees it', () => {
    const candidates = [candidate('k1', 'e1', 20)];
    const kept = eventConservationIssues({
      candidates,
      outcomes: [proposed(candidates[0])],
      lines: [manual(1, ['e1'])],
      epsilon,
    });
    expect(kept.map((i) => i.code)).toEqual(['EVENT_OVER_ALLOCATED']);
    const rejected = eventConservationIssues({
      candidates,
      outcomes: [
        {
          ...proposed(candidates[0]),
          state: 'rejected',
          effectiveQuantity: d(0),
        },
      ],
      lines: [manual(20, ['e1'])],
      epsilon,
    });
    expect(rejected).toEqual([]);
  });

  it('a replacement line counts against the event of the candidate it replaces', () => {
    const candidates = [candidate('k1', 'e1', 20)];
    const outcomes = [
      {
        ...proposed(candidates[0]),
        state: 'replaced' as const,
        effectiveQuantity: d(0),
      },
    ];
    const replace: ClaimLine = {
      ...manual(18, []),
      action: 'replace',
      autoKey: 'k1',
    };
    const issues = eventConservationIssues({
      candidates,
      outcomes,
      lines: [replace, manual(5, ['e1'])],
      epsilon,
    });
    expect(issues).toEqual([
      expect.objectContaining({ line: 1, expectedRemainingAllocation: '2' }),
    ]);
  });

  it('a line citing several events is checked against their joint loss', () => {
    const candidates = [candidate('k1', 'e1', 10), candidate('k2', 'e2', 10)];
    const outcomes = candidates.map((c) => ({
      ...proposed(c),
      state: 'rejected' as const,
      effectiveQuantity: d(0),
    }));
    expect(
      eventConservationIssues({
        candidates,
        outcomes,
        lines: [manual(20, ['e1', 'e2'])],
        epsilon,
      }),
    ).toEqual([]);
    expect(
      eventConservationIssues({
        candidates,
        outcomes,
        lines: [manual(21, ['e1', 'e2'])],
        epsilon,
      }),
    ).toHaveLength(1);
  });

  it('each kind is its own quantity basis: restart scrap after a stop is not part of its downtime loss', () => {
    const candidates = [candidate('k1', 'e1', 90)];
    const outcomes = [proposed(candidates[0])];
    const scrap = { ...manual(10, ['e1']), kind: 'quality' as const };
    expect(
      eventConservationIssues({
        candidates,
        outcomes,
        lines: [scrap],
        epsilon,
      }),
    ).toEqual([]);
    expect(
      eventConservationIssues({
        candidates,
        outcomes,
        lines: [manual(10, ['e1'])],
        epsilon,
      }),
    ).toHaveLength(1);
  });

  it('gains, bridges and events without a computed loss are not capped (no authoritative total)', () => {
    const candidates = [candidate('k1', 'e1', 5)];
    const outcomes = [proposed(candidates[0])];
    const gain = { ...manual(50, ['e1']), kind: 'gain' as const };
    expect(
      eventConservationIssues({
        candidates,
        outcomes,
        lines: [gain, manual(50, ['e9'])],
        epsilon,
      }),
    ).toEqual([]);
  });
});
