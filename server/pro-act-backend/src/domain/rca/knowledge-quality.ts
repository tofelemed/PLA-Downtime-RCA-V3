/**
 * Quality score of an RCA knowledge entry (owner decision 2026-10-12): how complete and how useful the
 * documented learning is, 0–100, computed on the server from stored facts only (nothing estimated).
 *
 * | factor        | points | rule                                                                  |
 * |---------------|--------|-----------------------------------------------------------------------|
 * | rootCause     | 30     | the root cause is written down (non-blank)                            |
 * | problem       | 15     | a problem statement or description is written down                    |
 * | recommendations | 10   | at least one recommendation                                           |
 * | actions       | 10     | the source case has at least one tracked action                       |
 * | effective     | 10     | the source case's actions were verified effective (RCA-08, CA9)        |
 * | scope         | 10     | the entry names a unit or an asset                                    |
 * | sourceCase    | 5      | the entry is still linked to its source case                          |
 * | feedback      | 10     | helpful ÷ (helpful + not helpful) × 10; 0 while nobody voted          |
 *
 * Each factor is rounded to a whole point; the score is their sum.
 */
export interface KnowledgeQualityInput {
  rootCause: string | null;
  problem: string | null;
  recommendationCount: number;
  /** actions of the source case by status */
  actions: { total: number; done: number; cancelled: number };
  /** the source case's verified effectiveness (null = not verified); "done" alone earns nothing */
  effectiveness: 'effective' | 'not_effective' | 'insufficient_evidence' | null;
  hasScope: boolean;
  hasSourceCase: boolean;
  helpful: number;
  notHelpful: number;
}

export const KNOWLEDGE_QUALITY_FACTORS = [
  'rootCause',
  'problem',
  'recommendations',
  'actions',
  'effective',
  'scope',
  'sourceCase',
  'feedback',
] as const;
export type KnowledgeQualityFactor = (typeof KNOWLEDGE_QUALITY_FACTORS)[number];

export const KNOWLEDGE_QUALITY_MAX: Readonly<
  Record<KnowledgeQualityFactor, number>
> = {
  rootCause: 30,
  problem: 15,
  recommendations: 10,
  actions: 10,
  effective: 10,
  scope: 10,
  sourceCase: 5,
  feedback: 10,
};

export interface KnowledgeQualityPart {
  factor: KnowledgeQualityFactor;
  points: number;
  max: number;
}

export interface KnowledgeQuality {
  score: number;
  parts: KnowledgeQualityPart[];
}

const written = (text: string | null): boolean =>
  typeof text === 'string' && text.trim().length > 0;

/** 0..1 share, 0 when the denominator is not positive. */
const share = (part: number, whole: number): number =>
  whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;

function fractions(
  input: KnowledgeQualityInput,
): Record<KnowledgeQualityFactor, number> {
  return {
    rootCause: written(input.rootCause) ? 1 : 0,
    problem: written(input.problem) ? 1 : 0,
    recommendations: input.recommendationCount > 0 ? 1 : 0,
    actions: input.actions.total > 0 ? 1 : 0,
    effective: input.effectiveness === 'effective' ? 1 : 0,
    scope: input.hasScope ? 1 : 0,
    sourceCase: input.hasSourceCase ? 1 : 0,
    feedback: share(input.helpful, input.helpful + input.notHelpful),
  };
}

export function knowledgeQuality(
  input: KnowledgeQualityInput,
): KnowledgeQuality {
  const fraction = fractions(input);
  const parts = KNOWLEDGE_QUALITY_FACTORS.map((factor) => {
    const max = KNOWLEDGE_QUALITY_MAX[factor];
    return { factor, points: Math.round(fraction[factor] * max), max };
  });
  return {
    score: parts.reduce((sum, part) => sum + part.points, 0),
    parts,
  };
}
