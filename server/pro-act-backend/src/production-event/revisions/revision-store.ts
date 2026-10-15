import { EntityManager } from 'typeorm';
import { ProductionEvent } from '../production-event.entity';
import { EventCoding } from './event-coding.entity';
import {
  CODING_FIELDS,
  EFFECTIVE_FIELDS,
  EventFacts,
  factsOf,
} from './event-facts';
import { EventRevision, RevisionKind } from './event-revision.entity';
import { RevisionActor } from './revision-actor';

/** Reads and appends of the revision tables inside a caller's transaction (event row locked). */

/** `SELECT ... FOR UPDATE` of one event, optionally limited to a tenant. */
export function lockEvent(
  manager: EntityManager,
  eventId: string,
  tenantId?: string,
): Promise<ProductionEvent | null> {
  const qb = manager
    .getRepository(ProductionEvent)
    .createQueryBuilder('event')
    .setLock('pessimistic_write')
    .where('event.id = :eventId', { eventId });
  if (tenantId) {
    qb.andWhere('event.tenantId = :tenantId', { tenantId });
  }
  return qb.getOne();
}

export async function reloadEvent(
  manager: EntityManager,
  eventId: string,
): Promise<ProductionEvent> {
  return manager
    .getRepository(ProductionEvent)
    .findOneByOrFail({ id: eventId });
}

export function latestSourceRevision(
  manager: EntityManager,
  eventId: string,
): Promise<EventRevision | null> {
  return manager.getRepository(EventRevision).findOne({
    where: { eventId, kind: 'source' },
    order: { revision: 'DESC' },
  });
}

/** Next number of the per-event revision sequence (all kinds). */
export async function nextRevisionNumber(
  manager: EntityManager,
  eventId: string,
): Promise<number> {
  const row = await manager
    .getRepository(EventRevision)
    .createQueryBuilder('rev')
    .select('COALESCE(MAX(rev.revision), 0)', 'max')
    .where('rev.eventId = :eventId', { eventId })
    .getRawOne<{ max: number | string }>();
  return Number(row?.max ?? 0) + 1;
}

/**
 * Applies `columns` to the event (bumps `row_version` and `updated_at`) and returns the stored row.
 * `undefined` entries are dropped so they never reach the SET clause.
 */
export async function writeEvent(
  manager: EntityManager,
  eventId: string,
  columns: Partial<ProductionEvent>,
): Promise<ProductionEvent> {
  const set = Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as Partial<ProductionEvent>;
  await manager
    .createQueryBuilder()
    .update(ProductionEvent)
    .set(set)
    .where('id = :eventId', { eventId })
    .execute();
  return reloadEvent(manager, eventId);
}

export interface RevisionInput {
  revision: number;
  kind: RevisionKind;
  actor: RevisionActor;
  sourceFacts?: EventFacts | null;
  changeReason?: string | null;
  sourceRevision?: string | null;
}

/** Inserts `event_revisions` with the event's current effective snapshot. */
export function appendRevision(
  manager: EntityManager,
  event: ProductionEvent,
  input: RevisionInput,
): Promise<EventRevision> {
  const repository = manager.getRepository(EventRevision);
  return repository.save(
    repository.create({
      tenantId: requireTenant(event),
      eventId: event.id,
      revision: input.revision,
      kind: input.kind,
      sourceFacts: input.sourceFacts ?? null,
      effectiveFacts: factsOf(event, EFFECTIVE_FIELDS),
      changeReason: input.changeReason ?? null,
      actorId: input.actor.id,
      actorKind: input.actor.kind,
      sourceRevision: input.sourceRevision ?? null,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    }),
  );
}

export interface CodingInput {
  revision: number;
  actor: RevisionActor;
  oldValues: EventFacts;
  newValues: EventFacts;
  reason: string | null;
  overridesSourceRevision: number | null;
}

/** Inserts `event_coding` with the event's current coding columns and their current code versions. */
export async function appendCoding(
  manager: EntityManager,
  event: ProductionEvent,
  input: CodingInput,
): Promise<EventCoding> {
  const repository = manager.getRepository(EventCoding);
  const versions = await currentCodeVersions(manager, event);
  return repository.save(
    repository.create({
      tenantId: requireTenant(event),
      eventId: event.id,
      revision: input.revision,
      reasonCodeId: event.reasonCodeId ?? null,
      impactCodeId: event.impactCodeId ?? null,
      oeeCodeId: event.oeeCodeId ?? null,
      reasonCodeVersionId: versions.reason ?? null,
      impactCodeVersionId: versions.impact ?? null,
      oeeCodeVersionId: versions.oee ?? null,
      scheduleClass: event.scheduleClass,
      oeeComponent: event.oeeComponent,
      impactMode: event.impactMode,
      impactFraction: toDecimalText(event.impactFraction),
      comment: event.description ?? null,
      isOverride: input.overridesSourceRevision !== null,
      overridesSourceRevision: input.overridesSourceRevision,
      oldValues: input.oldValues,
      newValues: input.newValues,
      reason: input.reason,
      authorId: input.actor.id,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    }),
  );
}

/** Latest `code_versions` id per library of the event's reason, impact and OEE codes. */
async function currentCodeVersions(
  manager: EntityManager,
  event: ProductionEvent,
): Promise<Partial<Record<'reason' | 'impact' | 'oee', string>>> {
  const ids = [event.reasonCodeId, event.impactCodeId, event.oeeCodeId];
  if (ids.every((id) => !id)) return {};
  const rows: Array<{ library: 'reason' | 'impact' | 'oee'; id: string }> =
    await manager.query(
      `SELECT DISTINCT ON (library) library, id FROM code_versions
        WHERE (library = 'reason' AND code_id = $1)
           OR (library = 'impact' AND code_id = $2)
           OR (library = 'oee' AND code_id = $3)
        ORDER BY library, version DESC`,
      ids.map((id) => id ?? null),
    );
  return Object.fromEntries(rows.map((row) => [row.library, row.id]));
}

/** Coding facts of an event (the baseline coding revision's `new_values`). */
export function codingFactsOf(event: ProductionEvent): EventFacts {
  return factsOf(event, CODING_FIELDS);
}

/** Events without a tenant (legacy rows) cannot carry revisions. */
export function hasRevisionTenant(event: ProductionEvent): boolean {
  return typeof event.tenantId === 'string';
}

function requireTenant(event: ProductionEvent): string {
  if (!event.tenantId) {
    throw new Error(`Event ${event.id} has no tenant; no revision kept`);
  }
  return event.tenantId;
}

function toDecimalText(
  value: number | string | null | undefined,
): string | null {
  return value === null || value === undefined ? null : String(value);
}
