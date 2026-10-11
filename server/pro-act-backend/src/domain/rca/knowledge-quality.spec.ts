import {
  KNOWLEDGE_QUALITY_MAX,
  knowledgeQuality,
  KnowledgeQualityInput,
} from './knowledge-quality';

const EMPTY: KnowledgeQualityInput = {
  rootCause: null,
  problem: null,
  recommendationCount: 0,
  actions: { total: 0, done: 0, cancelled: 0 },
  hasScope: false,
  hasSourceCase: false,
  helpful: 0,
  notHelpful: 0,
};

const FULL: KnowledgeQualityInput = {
  rootCause: 'Coupling misalignment',
  problem: 'Pump P-101 trips on vibration',
  recommendationCount: 2,
  actions: { total: 3, done: 2, cancelled: 1 },
  hasScope: true,
  hasSourceCase: true,
  helpful: 4,
  notHelpful: 0,
};

const points = (input: KnowledgeQualityInput, factor: string) =>
  knowledgeQuality(input).parts.find((part) => part.factor === factor)?.points;

describe('knowledgeQuality (RCA knowledge entry score)', () => {
  it('the maxima add up to 100', () => {
    const total = Object.values(KNOWLEDGE_QUALITY_MAX).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBe(100);
  });

  it('an empty entry scores 0 and a complete, well-rated one 100', () => {
    expect(knowledgeQuality(EMPTY).score).toBe(0);
    expect(knowledgeQuality(FULL).score).toBe(100);
  });

  it('blank text does not count as written', () => {
    expect(
      points({ ...EMPTY, rootCause: '   ', problem: '' }, 'rootCause'),
    ).toBe(0);
    expect(points({ ...EMPTY, rootCause: 'x' }, 'rootCause')).toBe(30);
    expect(points({ ...EMPTY, problem: 'stated' }, 'problem')).toBe(15);
  });

  it('done actions count against the non-cancelled ones only', () => {
    const half = { ...EMPTY, actions: { total: 5, done: 2, cancelled: 1 } };
    expect(points(half, 'actions')).toBe(10);
    expect(points(half, 'actionsDone')).toBe(5);
    const allCancelled = {
      ...EMPTY,
      actions: { total: 2, done: 0, cancelled: 2 },
    };
    expect(points(allCancelled, 'actionsDone')).toBe(0);
  });

  it('feedback is the helpful share of the votes and 0 without votes', () => {
    expect(points({ ...EMPTY, helpful: 3, notHelpful: 1 }, 'feedback')).toBe(8);
    expect(points({ ...EMPTY, helpful: 0, notHelpful: 2 }, 'feedback')).toBe(0);
    expect(points(EMPTY, 'feedback')).toBe(0);
  });

  it('the score is the sum of the rounded parts', () => {
    const result = knowledgeQuality({
      ...EMPTY,
      rootCause: 'x',
      hasScope: true,
      hasSourceCase: true,
      helpful: 1,
      notHelpful: 2,
    });
    expect(result.score).toBe(30 + 10 + 5 + 3);
    expect(result.parts.reduce((sum, p) => sum + p.points, 0)).toBe(
      result.score,
    );
  });
});
