import { FaultTreeNode, topEventProbability } from './fault-tree';

const node = (
  id: string,
  type: string,
  parentId: string | null,
  probability: number | null = null,
): FaultTreeNode => ({ id, type, parentId, probability });

describe('topEventProbability (RCA-06)', () => {
  it('an OR gate: 1 − Π(1 − p) over its inputs', () => {
    const result = topEventProbability([
      node('top', 'OR', null),
      node('a', 'BasicEvent', 'top', 0.1),
      node('b', 'BasicEvent', 'top', 0.2),
    ]);
    expect(result.probability).toBeCloseTo(1 - 0.9 * 0.8, 12);
    expect(result.reason).toBeNull();
  });

  it('an AND gate: Π p; an intermediate event takes its single input', () => {
    const result = topEventProbability([
      node('top', 'Event', null),
      node('g', 'AND', 'top'),
      node('a', 'BasicEvent', 'g', 0.5),
      node('or', 'OR', 'g'),
      node('b', 'BasicEvent', 'or', 0.1),
      node('c', 'BasicEvent', 'or', 0.1),
    ]);
    expect(result.probability).toBeCloseTo(0.5 * (1 - 0.81), 12);
  });

  it('a basic event without a probability leaves the top event unknown', () => {
    expect(
      topEventProbability([
        node('top', 'OR', null),
        node('a', 'BasicEvent', 'top', 0.1),
        node('b', 'BasicEvent', 'top'),
      ]),
    ).toEqual({ probability: null, reason: 'probability_missing' });
  });

  it('no single root, a gate without inputs or a cycle is not computable', () => {
    expect(topEventProbability([])).toEqual({
      probability: null,
      reason: 'no_single_top_event',
    });
    expect(topEventProbability([node('top', 'AND', null)])).toEqual({
      probability: null,
      reason: 'gate_without_inputs',
    });
    expect(
      topEventProbability([
        node('top', 'OR', null),
        node('x', 'OR', 'y'),
        node('y', 'OR', 'x'),
      ]).reason,
    ).toBe('not_a_tree');
  });
});
