import type { RcaLinkView } from '@/api/v2/types/rca';

/** The event that started the case: the first event linked (the server lists links in link order). */
export function triggerLinkOf(links: readonly RcaLinkView[]): { trigger: RcaLinkView | null; others: number } {
  const events = links.filter((link) => link.linkType === 'event');
  const sorted = [...events].sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
  return { trigger: sorted[0] ?? null, others: Math.max(0, sorted.length - 1) };
}
