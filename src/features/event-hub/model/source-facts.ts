import type { EventRevisionView } from '@/api/v2/types/events';

/** Latest effective facts and the latest facts a source delivered (ING06), side by side. */
export function latestFacts(revisions: readonly EventRevisionView[]) {
  const ordered = [...revisions].sort((a, b) => b.revision - a.revision);
  const effective = ordered[0]?.effectiveFacts ?? {};
  const source = ordered.find((revision) => revision.sourceFacts)?.sourceFacts ?? null;
  return { effective, source };
}
