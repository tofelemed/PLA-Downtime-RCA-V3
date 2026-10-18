import type { EventRevisionView, ProductionEventView } from '@/api/v2/types/events';

/** Latest effective facts and the latest facts a source delivered (ING06), side by side. */
export function latestFacts(revisions: readonly EventRevisionView[]) {
  const ordered = [...revisions].sort((a, b) => b.revision - a.revision);
  const effective = ordered[0]?.effectiveFacts ?? {};
  const source = ordered.find((revision) => revision.sourceFacts)?.sourceFacts ?? null;
  return { effective, source };
}

/**
 * The user revision that last changed `field`'s effective value (newest first), so an override can say who
 * made it; null when no user revision changed it (e.g. a revision log older than the override).
 */
export function lastUserChangeOf(revisions: readonly EventRevisionView[], field: string): EventRevisionView | null {
  const ordered = [...revisions].sort((a, b) => a.revision - b.revision);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const revision = ordered[index];
    const before = index > 0 ? ordered[index - 1].effectiveFacts[field] : undefined;
    const changed = JSON.stringify(before) !== JSON.stringify(revision.effectiveFacts[field]);
    if (changed && revision.actorKind === 'user') return revision;
  }
  return null;
}

/** Number of the newest revision in the history (what the History tab lists last); null without revisions. */
export function latestRevisionNumber(revisions: readonly EventRevisionView[]): number | null {
  return revisions.reduce<number | null>((max, revision) => (max === null || revision.revision > max ? revision.revision : max), null);
}

/**
 * The event's current state and coding as the event row holds them now (O1): a current-state display reads
 * these, not the facts frozen into the latest revision, which are history ("at revision N").
 */
export function currentStateFacts(event: ProductionEventView): Record<string, unknown> {
  return {
    status: event.status,
    codingState: event.states.coding,
    physicalState: event.states.physical,
    rcaState: event.states.rca,
    reasonCodeId: event.reasonCodeId,
    impactCodeId: event.impactCodeId,
    physicalType: event.classification.physicalType,
    scheduleClass: event.classification.scheduleClass,
    oeeComponent: event.classification.oeeComponent,
    impactMode: event.classification.impactMode,
    ...(event.investigationPending === undefined ? {} : { investigationPending: event.investigationPending }),
  };
}
