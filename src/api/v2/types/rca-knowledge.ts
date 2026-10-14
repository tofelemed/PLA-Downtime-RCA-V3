/**
 * v2 RCA knowledge views (owner decision 2026-10-12; backend `src/rca-knowledge-base/knowledge-v2.view.ts`).
 * The quality score and its parts are computed by the server; the browser only shows them.
 */
export type KnowledgeVote = 'helpful' | 'not_helpful';
export type KnowledgeMatch = 'failure_mode' | 'asset' | 'reason' | 'text' | 'unit';
/** CA9: verified practice (effective), caution (not effective) or unverified */
export type KnowledgeLessonStatus = 'verified_practice' | 'caution' | 'unverified';

export interface KnowledgeQualityPart {
  factor: string;
  points: number;
  max: number;
}

export interface RcaKnowledgeView {
  id: string;
  rowVersion: number;
  title: string;
  description: string | null;
  problemStatement: string | null;
  rootCause: string | null;
  rootCauseCategory: string | null;
  category: string | null;
  unitId: string | null;
  unitName: string | null;
  assetId: string | null;
  assetName: string | null;
  rcaId: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
  /** CA2 verified effectiveness of the source case (null = not verified) */
  caseEffectiveness: 'effective' | 'not_effective' | 'insufficient_evidence' | null;
  lessonStatus: KnowledgeLessonStatus | null;
  failureMode: string | null;
  /** tenant (this plant only) or organization (shared read-only with the other plants) */
  shareScope: 'tenant' | 'organization';
  sharedAt: string | null;
  recommendations: string[];
  actionsSummary: { recommendations: number; actions: number; done: number; cancelled: number };
  helpfulCount: number;
  notHelpfulCount: number;
  myVote: KnowledgeVote | null;
  isPublished: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  author: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  qualityScore: number;
  quality: KnowledgeQualityPart[];
}

export interface RcaKnowledgeSimilarView extends RcaKnowledgeView {
  matchedOn: KnowledgeMatch[];
  relevance: number;
}

/** A lesson another plant of the organization shared (`GET /v2/rca-knowledge/shared`): read-only, redacted. */
export interface SharedLessonView {
  id: string;
  sourcePlant: string;
  title: string;
  problemStatement: string | null;
  rootCause: string | null;
  recommendations: string[];
  failureMode: string | null;
  equipmentCategory: string | null;
  lessonStatus: KnowledgeLessonStatus;
  sharedAt: string;
}
