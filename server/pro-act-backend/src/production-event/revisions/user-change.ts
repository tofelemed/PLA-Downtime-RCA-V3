import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertRevision } from '../../common/concurrency/revision';
import { ProductionEvent } from '../production-event.entity';
import { changeMessage, EventChangeMessage } from './event-change.notifier';
import {
  changedFields,
  completeFacts,
  EFFECTIVE_FIELDS,
  EventFacts,
  factsOf,
  OVERRIDABLE_FIELDS,
} from './event-facts';
import { RevisionActor } from './revision-actor';
import {
  appendCoding,
  appendRevision,
  hasRevisionTenant,
  latestSourceRevision,
  lockEvent,
  nextRevisionNumber,
  writeEvent,
} from './revision-store';
import { RevisionResult } from './source-revision';

export type EventPatch =
  | Partial<ProductionEvent>
  | ((locked: ProductionEvent) => Partial<ProductionEvent>);

/** A user edit of an event (v1 PUT, v2 PATCH, review decisions). */
export interface UserChange {
  actor: RevisionActor;
  eventId: string;
  /** v2: the acting tenant; another tenant's event is "not found" */
  tenantId?: string;
  /** v2 `If-Match`: 412 unless the locked row still has this `row_version` */
  expectedRowVersion?: number;
  /** columns to write, or a function computing them from the locked row */
  patch: EventPatch;
  reason?: string;
}

/**
 * ING06 user layer: writes the columns, records a coding revision (old/new values, override of the
 * source value with the overridden source revision) and an effective revision. Fields that differ
 * from what the source delivered become `user_overrides`, so later source revisions cannot reset them.
 */
export async function applyUserChangeIn(
  manager: EntityManager,
  change: UserChange,
): Promise<RevisionResult<ProductionEvent | null>> {
  const existing = await lockEvent(manager, change.eventId, change.tenantId);
  if (!existing) {
    return { result: null, message: null };
  }
  assertNotSuperseded(existing);
  if (change.expectedRowVersion !== undefined) {
    assertRevision(existing.rowVersion, change.expectedRowVersion);
  }
  const patch =
    typeof change.patch === 'function' ? change.patch(existing) : change.patch;
  const changed = changedFields(
    factsOf(existing, EFFECTIVE_FIELDS),
    factsOf({ ...existing, ...definedOnly(patch) }, EFFECTIVE_FIELDS),
  );
  if (changed.length === 0 || !hasRevisionTenant(existing)) {
    const result = await writeEvent(manager, existing.id, patch);
    return { result, message: null };
  }
  return recordUserChange(manager, existing, patch, { change, changed });
}

async function recordUserChange(
  manager: EntityManager,
  existing: ProductionEvent,
  patch: Partial<ProductionEvent>,
  context: { change: UserChange; changed: string[] },
): Promise<RevisionResult<ProductionEvent>> {
  const { change, changed } = context;
  const source =
    existing.currentSourceRevision > 0
      ? await latestSourceRevision(manager, existing.id)
      : null;
  const codingRevision = existing.currentCodingRevision + 1;
  const overridden = source
    ? changed.filter((field) => OVERRIDABLE_FIELDS.includes(field))
    : [];
  const updated = await writeEvent(manager, existing.id, {
    ...patch,
    currentCodingRevision: codingRevision,
    userOverrides: withOverrides(existing, overridden, codingRevision),
  });
  const isOverride = changed.some(
    (field) => (source?.sourceFacts?.[field] ?? null) !== null,
  );
  const message = await appendUserRevisions(manager, existing, updated, {
    actor: change.actor,
    fields: changed,
    reason: change.reason ?? null,
    overridesSourceRevision: isOverride ? existing.currentSourceRevision : null,
  });
  return { result: updated, message };
}

/**
 * Coding revision (`after.currentCodingRevision`, old/new values of `fields`) and effective `user`
 * revision for a user decision already written to the event.
 */
export async function appendUserRevisions(
  manager: EntityManager,
  before: ProductionEvent,
  after: ProductionEvent,
  input: {
    actor: RevisionActor;
    fields: readonly string[];
    reason: string | null;
    overridesSourceRevision: number | null;
  },
): Promise<EventChangeMessage> {
  await appendCoding(manager, after, {
    revision: after.currentCodingRevision,
    actor: input.actor,
    ...valuesOf(before, after, input.fields),
    reason: input.reason,
    overridesSourceRevision: input.overridesSourceRevision,
  });
  const revision = await nextRevisionNumber(manager, after.id);
  await appendRevision(manager, after, {
    revision,
    kind: 'user',
    actor: input.actor,
    changeReason: input.reason,
  });
  return changeMessage(before, after, revision, 'user');
}

/** Old and new values of the changed fields (coding revision provenance). */
export function valuesOf(
  before: ProductionEvent,
  after: ProductionEvent,
  fields: readonly string[],
): { oldValues: EventFacts; newValues: EventFacts } {
  return {
    oldValues: completeFacts(factsOf(before, fields), fields),
    newValues: completeFacts(factsOf(after, fields), fields),
  };
}

/** 409 INVALID_STATE: a split/merge contributor is lineage only; its replacements are edited instead. */
export function assertNotSuperseded(event: ProductionEvent): void {
  if (event.physicalState === 'superseded') {
    throw new ConflictException({
      code: 'INVALID_STATE',
      message:
        'The event was superseded by a split or merge; edit the events that replaced it',
    });
  }
}

function withOverrides(
  existing: ProductionEvent,
  fields: readonly string[],
  codingRevision: number,
): Record<string, number> {
  const overrides = { ...(existing.userOverrides ?? {}) };
  for (const field of fields) overrides[field] = codingRevision;
  return overrides;
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
