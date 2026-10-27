import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { uncodedVerificationReset } from '../../domain/events/coding-verification';
import { toLegacyStatus } from '../../domain/events/legacy-status';
import {
  activeCodingRulesIn,
  CodingRuleSource,
} from '../../rules/active-coding-rules';
import { ActiveCodingRule, retypedAxes } from '../../rules/rule-defaults';
import { parseDeclaredFigures } from '../../domain/events/declared-figures';
import {
  EventWriteInput,
  IntervalModelFields,
  prepareUpdate,
} from '../event-write-model';
import { ProductionEvent } from '../production-event.entity';
import { EventChangeMessage, changeMessage } from './event-change.notifier';
import { EventCoding } from './event-coding.entity';
import {
  changedFields,
  completeFacts,
  EventFacts,
  normalizeFacts,
  SOURCE_COLUMN_FIELDS,
  SOURCE_FIELDS,
} from './event-facts';
import { EventReviewItem } from './event-review-item.entity';
import { ActorKind, EventRevision } from './event-revision.entity';
import { RevisionActor } from './revision-actor';
import {
  confirmedOverrides,
  resolveConfirmed,
  withoutOverrides,
} from './source-confirmation';
import {
  appendRevision,
  hasRevisionTenant,
  latestSourceRevision,
  lockEvent,
  nextRevisionNumber,
  writeEvent,
} from './revision-store';

/** Where a source delivery came from (ING06 provenance). */
export interface SourceProvenance {
  actorKind: Extract<ActorKind, 'connector' | 'system'>;
  /** the source's own version marker, e.g. the PI frame end time */
  sourceRevision?: string;
  reason?: string;
}

export type SourceOutcome = 'duplicate' | 'revised';

/** Result of a revision operation plus the message to publish after commit. */
export interface RevisionResult<T> {
  result: T;
  message: EventChangeMessage | null;
}

const CLASSIFICATION_KEYS = [
  'physicalType',
  'scheduleClass',
  'oeeComponent',
  'impactMode',
] as const;
const DATE_FIELDS: ReadonlySet<string> = new Set(['startTime', 'endTime']);

/**
 * ING01/ING06: identical content is a duplicate delivery (counted, no revision). Otherwise the changed
 * source fields without a user override are written, overridden ones open a review item (unless the
 * source now confirms the user's value: the override is dropped and its open items resolved, plan 1.4),
 * and a source revision is recorded. Coding, RCA and workflow state are never reset (B5/I1).
 */
export async function applySourceIn(
  manager: EntityManager,
  eventId: string,
  rawFacts: Readonly<Record<string, unknown>>,
  provenance: SourceProvenance,
  rules?: CodingRuleSource,
): Promise<RevisionResult<SourceOutcome>> {
  const existing = await lockTracked(manager, eventId);
  const facts = completeFacts(
    normalizeFacts(rawFacts, SOURCE_FIELDS),
    SOURCE_FIELDS,
  );
  const previous = await latestSourceRevision(manager, eventId);
  const changed = changedFields(previous?.sourceFacts ?? {}, facts);
  if (changed.length === 0) {
    await countDuplicate(manager, eventId);
    return { result: 'duplicate', message: null };
  }
  const overrides = existing.userOverrides ?? {};
  const plan = planFields(existing, facts, changed);
  const revision = await nextRevisionNumber(manager, eventId);
  const ruleSet = retypes(existing, facts, plan.accepted)
    ? await (rules ?? (() => activeCodingRulesIn(manager, existing.tenantId)))()
    : [];
  const updated = await writeEvent(manager, eventId, {
    ...sourceColumns(existing, facts, plan.accepted, ruleSet),
    ...(plan.confirmed.length > 0
      ? { userOverrides: withoutOverrides(overrides, plan.confirmed) }
      : {}),
    currentSourceRevision: revision,
  });
  const stored = await appendRevision(manager, updated, {
    revision,
    kind: 'source',
    actor: { id: null, kind: provenance.actorKind },
    sourceFacts: facts,
    changeReason: provenance.reason,
    sourceRevision: provenance.sourceRevision,
  });
  await openConflicts(manager, updated, stored, plan.conflicts);
  await resolveConfirmed(manager, eventId, plan.confirmed);
  if (existing.physicalState === 'superseded') {
    await openLateCorrection(manager, updated, stored);
  }
  return {
    result: 'revised',
    message: changeMessage(existing, updated, revision, 'source'),
  };
}

/**
 * Changed source columns (attribute facts without a column, plan 1.3, stay in the revision only):
 * `accepted` are written, `conflicts` keep the user override and open a review item, `confirmed` are
 * overrides the source now delivers with the same value (dropped, items resolved; plan 1.4).
 */
function planFields(
  existing: ProductionEvent,
  facts: EventFacts,
  changed: readonly string[],
): { accepted: string[]; conflicts: string[]; confirmed: string[] } {
  const overrides = existing.userOverrides ?? {};
  const columns = changed.filter((field) =>
    SOURCE_COLUMN_FIELDS.includes(field),
  );
  const overridden = columns.filter((field) => overrides[field] !== undefined);
  const confirmed = confirmedOverrides(existing, facts, overridden);
  return {
    accepted: columns.filter((field) => overrides[field] === undefined),
    conflicts: overridden.filter((field) => !confirmed.includes(field)),
    confirmed,
  };
}

/** True when writing source `fields` from `facts` changes the stored event type. */
export function retypes(
  existing: ProductionEvent,
  facts: EventFacts,
  fields: readonly string[],
): boolean {
  return (
    fields.includes('eventType') &&
    (facts.eventType ?? null) !== (existing.eventType ?? null)
  );
}

/**
 * Columns for source `fields` taken from `facts`, with interval, classification, states, legacy status
 * and duration re-derived by the write model from the stored row. Classification axes the user
 * overrode keep the user's value even when the source changes the event type; on such a change the
 * other code-driven axes are re-filled by `rules` and the basis rebuilt (item 8 open question 1).
 */
export function sourceColumns(
  existing: ProductionEvent,
  facts: EventFacts,
  fields: readonly string[],
  rules: readonly ActiveCodingRule[],
): Partial<ProductionEvent> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = facts[field] ?? null;
    values[field] =
      DATE_FIELDS.has(field) && typeof value === 'string'
        ? new Date(value)
        : value;
  }
  const lossColumns = declaredColumns(fields, values);
  const derived = prepareUpdate(existing, {
    startTime: values.startTime as Date | undefined,
    endTime: fields.includes('endTime')
      ? ((values.endTime as Date | null) ?? null)
      : undefined,
    eventType: values.eventType as string | null | undefined,
    ...lossColumns,
  });
  const overrides = existing.userOverrides ?? {};
  for (const key of CLASSIFICATION_KEYS) {
    if (overrides[key] !== undefined) {
      Object.assign(derived, { [key]: existing[key] });
    }
  }
  const axes = retypes(existing, facts, fields)
    ? retypedColumns(rules, existing, derived, values)
    : {};
  return {
    ...values,
    ...lossColumns,
    ...derived,
    ...axes,
    ...uncodedVerificationReset(existing, derived),
  } as Partial<ProductionEvent>;
}

/**
 * Declared figures delivered by the source: the column holds the parsed figures and the quantity follows the
 * shortfall (the figures are the source of truth); nothing when the revision does not change them.
 */
function declaredColumns(
  fields: readonly string[],
  values: Readonly<Record<string, unknown>>,
): Pick<EventWriteInput, 'quantity' | 'declaredFigures'> {
  if (!fields.includes('declaredFigures')) return {};
  const figures = parseDeclaredFigures(values.declaredFigures);
  return figures
    ? { declaredFigures: figures, quantity: figures.shortfall }
    : { declaredFigures: null };
}

/** The code-driven axes and basis after an event-type change, as columns. */
function retypedColumns(
  rules: readonly ActiveCodingRule[],
  existing: ProductionEvent,
  derived: IntervalModelFields,
  values: Readonly<Record<string, unknown>>,
): Partial<ProductionEvent> {
  const axes = retypedAxes(rules, existing, {
    ...derived,
    eventType: values.eventType as string | null,
    source: existing.source,
    reasonCodeId: existing.reasonCodeId,
    unitId: existing.unitId,
    assetId: existing.assetId,
  });
  return {
    scheduleClass: axes.scheduleClass,
    oeeComponent: axes.oeeComponent,
    impactCodeId: axes.impactCodeId,
    classificationBasis: axes.classificationBasis,
  } as Partial<ProductionEvent>;
}

/** Tombstones an event (ING01): never deleted, `retracted` everywhere, legacy status 'Cancelled'. */
export async function retractIn(
  manager: EntityManager,
  eventId: string,
  provenance: { actor: RevisionActor; reason: string; sourceRevision?: string },
): Promise<RevisionResult<ProductionEvent>> {
  const existing = await lockTracked(manager, eventId);
  if (existing.physicalState === 'retracted') {
    return { result: existing, message: null };
  }
  const states = {
    physicalState: 'retracted' as const,
    codingState: existing.codingState,
    rcaState: existing.rcaState,
  };
  const updated = await writeEvent(manager, eventId, {
    physicalState: states.physicalState,
    retractedAt: new Date(),
    status: toLegacyStatus(states),
  });
  const revision = await nextRevisionNumber(manager, eventId);
  await appendRevision(manager, updated, {
    revision,
    kind: 'retraction',
    actor: provenance.actor,
    changeReason: provenance.reason,
    sourceRevision: provenance.sourceRevision,
  });
  return {
    result: updated,
    message: changeMessage(existing, updated, revision, 'retraction'),
  };
}

/** Raw UPDATE: a duplicate changes nothing a client sees, so `row_version` must not move. */
async function countDuplicate(
  manager: EntityManager,
  eventId: string,
): Promise<void> {
  await manager.query(
    `UPDATE "production_events" SET "duplicate_deliveries" = "duplicate_deliveries" + 1 WHERE "id" = $1`,
    [eventId],
  );
}

async function lockTracked(
  manager: EntityManager,
  eventId: string,
): Promise<ProductionEvent> {
  const existing = await lockEvent(manager, eventId);
  if (!existing) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Event not found',
    });
  }
  if (!hasRevisionTenant(existing)) {
    throw new UnprocessableEntityException({
      code: 'EVENT_WITHOUT_TENANT',
      message: `Event ${eventId} has no uuid tenant and cannot be revised`,
    });
  }
  return existing;
}

/** §5.3: one open `source_vs_override_conflict` per overridden field the source changed. */
async function openConflicts(
  manager: EntityManager,
  event: ProductionEvent,
  sourceRevision: EventRevision,
  fields: readonly string[],
): Promise<void> {
  const overrides = event.userOverrides ?? {};
  const items = manager.getRepository(EventReviewItem);
  for (const field of fields) {
    const coding = await manager.getRepository(EventCoding).findOne({
      where: { eventId: event.id, revision: overrides[field] },
      select: { id: true },
    });
    await items.save(
      items.create({
        tenantId: sourceRevision.tenantId,
        eventId: event.id,
        kind: 'source_vs_override_conflict',
        field,
        sourceRevisionId: sourceRevision.id,
        codingRevisionId: coding?.id ?? null,
        state: 'open',
        createdBy: null,
        updatedBy: null,
      }),
    );
  }
}

/**
 * The source corrected an event that a split or merge already replaced (plan 1.4): the correction is
 * kept on the superseded event (source evidence is never moved) and a person reviews the replacements.
 */
async function openLateCorrection(
  manager: EntityManager,
  event: ProductionEvent,
  sourceRevision: EventRevision,
): Promise<void> {
  const items = manager.getRepository(EventReviewItem);
  await items.save(
    items.create({
      tenantId: sourceRevision.tenantId,
      eventId: event.id,
      kind: 'late_correction',
      field: null,
      sourceRevisionId: sourceRevision.id,
      codingRevisionId: null,
      state: 'open',
      createdBy: null,
      updatedBy: null,
    }),
  );
}
