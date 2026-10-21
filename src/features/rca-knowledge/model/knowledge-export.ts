import { v2Request } from '@/api/v2/client';
import type { RcaKnowledgeFilters } from '@/api/v2/queries/rca-knowledge';
import type { QueryParams } from '@/api/v2/request-url';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';

/** An export reads at most this many entries (20 server pages of 100). */
export const EXPORT_LIMIT = 2000;

const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Every entry matching the filters, page by page (keyset), up to the export limit. */
export async function fetchKnowledgeForExport(filters: RcaKnowledgeFilters): Promise<{ entries: RcaKnowledgeView[]; truncated: boolean }> {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as QueryParams;
  const entries: RcaKnowledgeView[] = [];
  let cursor: string | null = null;
  do {
    const page: ListResponse<RcaKnowledgeView> = (await v2Request<ListResponse<RcaKnowledgeView>>({ method: 'GET', path: '/rca-knowledge', query: { ...query, limit: 100, cursor: cursor ?? undefined } })).data;
    entries.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && entries.length < EXPORT_LIMIT);
  return { entries: entries.slice(0, EXPORT_LIMIT), truncated: Boolean(cursor) };
}

/** CSV of the entries (names, never ids; dates ISO / UTC). */
export function knowledgeCsv(entries: readonly RcaKnowledgeView[]): string {
  const header = ['Title', 'Problem', 'Root cause', 'Recommendations', 'Unit', 'Asset', 'Quality', 'Published', 'Helpful', 'Not helpful', 'Closed at (UTC)'];
  const rows = entries.map((e) => [
    e.title,
    e.problemStatement ?? e.description,
    e.rootCause,
    e.recommendations.join('; '),
    e.unitName,
    e.assetName,
    e.qualityScore,
    e.isPublished ? 'Yes' : 'No',
    e.helpfulCount,
    e.notHelpfulCount,
    e.closedAt,
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}
