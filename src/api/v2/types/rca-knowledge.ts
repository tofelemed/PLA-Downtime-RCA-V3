/**
 * v2 RCA knowledge views (owner decision 2026-10-12; backend `src/rca-knowledge-base/knowledge-v2.view.ts`).
 * The quality score and its parts are computed by the server; the browser only shows them.
 */
export type KnowledgeVote = 'helpful' | 'not_helpful';
export type KnowledgeMatch = 'asset' | 'reason' | 'unit';

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
