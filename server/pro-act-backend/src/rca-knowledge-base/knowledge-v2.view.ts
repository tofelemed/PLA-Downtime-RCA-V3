import {
  knowledgeQuality,
  KnowledgeQualityPart,
} from '../domain/rca/knowledge-quality';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';

export type KnowledgeVote = 'helpful' | 'not_helpful';
export type KnowledgeMatch = 'asset' | 'reason' | 'unit';

export interface KnowledgeActionsSummary {
  recommendations: number;
  actions: number;
  done: number;
  cancelled: number;
}

/** A knowledge entry on v2 (owner decision 2026-10-12); quality is computed on the server. */
export interface RcaKnowledgeV2View {
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
  actionsSummary: KnowledgeActionsSummary;
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
  /** 0–100, `knowledgeQuality()` (src/domain/rca/knowledge-quality.ts) */
  qualityScore: number;
  quality: KnowledgeQualityPart[];
}

export interface RcaKnowledgeSimilarV2View extends RcaKnowledgeV2View {
  /** what the entry shares with the event, strongest first */
  matchedOn: KnowledgeMatch[];
  /** asset 3 + reason 2 + unit 1 */
  relevance: number;
}

/** Facts around an entry loaded in bulk for a page (`loadKnowledgeDetails`). */
export interface KnowledgeDetails {
  unitName: string | null;
  assetName: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
  actions: { total: number; done: number; cancelled: number };
  helpful: number;
  notHelpful: number;
  myVote: KnowledgeVote | null;
}

export const NO_ACTIONS = { total: 0, done: 0, cancelled: 0 } as const;

/** Recommendation titles from the stored JSON (case close writes titles; older rows may hold objects). */
export function recommendationTitles(value: unknown): string[] {
  const list = Array.isArray(value) ? (value as unknown[]) : [];
  return list
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const title = (item as Record<string, unknown>).title;
        return typeof title === 'string' ? title : '';
      }
      return '';
    })
    .filter((title) => title.trim().length > 0);
}

const iso = (value: Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

export function toKnowledgeView(
  entry: RCAKnowledgeBase,
  details: KnowledgeDetails,
): RcaKnowledgeV2View {
  const recommendations = recommendationTitles(entry.recommendations);
  const quality = knowledgeQuality({
    rootCause: entry.rootCause ?? null,
    problem: entry.problemStatement || entry.description || null,
    recommendationCount: recommendations.length,
    actions: details.actions,
    hasScope: Boolean(entry.unitId || entry.assetId),
    hasSourceCase: Boolean(entry.rcaId),
    helpful: details.helpful,
    notHelpful: details.notHelpful,
  });
  return {
    id: entry.id,
    rowVersion: entry.rowVersion,
    title: entry.title,
    description: entry.description ?? null,
    problemStatement: entry.problemStatement ?? null,
    rootCause: entry.rootCause ?? null,
    rootCauseCategory: entry.rootCauseCategory ?? null,
    category: entry.category ?? null,
    unitId: entry.unitId ?? null,
    unitName: details.unitName ?? entry.unitName ?? null,
    assetId: entry.assetId ?? null,
    assetName: details.assetName ?? entry.assetName ?? null,
    rcaId: entry.rcaId ?? null,
    caseTitle: details.caseTitle,
    caseStatus: details.caseStatus,
    recommendations,
    actionsSummary: {
      recommendations: recommendations.length,
      actions: details.actions.total,
      done: details.actions.done,
      cancelled: details.actions.cancelled,
    },
    helpfulCount: details.helpful,
    notHelpfulCount: details.notHelpful,
    myVote: details.myVote,
    isPublished: entry.isPublished,
    publishedAt: iso(entry.publishedAt),
    publishedBy: entry.publishedBy ?? null,
    author: entry.author ?? null,
    closedAt: entry.closedDate ?? null,
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
    qualityScore: quality.score,
    quality: quality.parts,
  };
}
