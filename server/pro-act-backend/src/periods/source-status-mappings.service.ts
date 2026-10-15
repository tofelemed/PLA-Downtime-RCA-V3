import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { IMPORT_SOURCE } from '../domain/actuals/period/external-report';
import {
  assertNotAuthor,
  invalid,
  invalidTransition,
  notFound,
} from '../profiles/profile-errors';
import {
  SourceStatusEntry,
  SourceStatusMapping,
} from './entities/source-status-mapping.entity';
import { assertTenantWide } from './period-scope';

export interface StatusMappingDraft {
  sourceSystem: string;
  effectiveFrom: Date;
  statuses: SourceStatusEntry[];
  notes: string | null;
}

export interface StatusMappingList {
  items: SourceStatusMapping[];
  /** per source, the approved version whose interval contains now */
  inForceIds: ReadonlySet<string>;
  names: ReadonlyMap<string, string>;
}

/** Per source, the approved version in force at `at` (the highest version when intervals touch). */
export function inForceIdsOf(
  mappings: readonly SourceStatusMapping[],
  at: Date,
): Set<string> {
  const best = new Map<string, SourceStatusMapping>();
  for (const m of mappings) {
    if (m.state !== 'approved' || m.effectiveFrom > at) continue;
    if (m.effectiveTo && m.effectiveTo <= at) continue;
    const current = best.get(m.sourceSystem);
    if (!current || current.version < m.version) best.set(m.sourceSystem, m);
  }
  return new Set([...best.values()].map((m) => m.id));
}

/** The legacy environment list's statuses, for an `import` source that never had a mapping. */
const LEGACY_IMPORT_STATUSES: SourceStatusEntry[] = [
  { status: 'COMPLETED', released: true },
  { status: 'RELEASED', released: true },
];

const LEGACY_NOTE =
  'Seeded on first use from the former EXTERNAL_REPORT_CERTIFIED_STATUSES default — the source owner confirms or replaces it (SME R13).';

/**
 * Per-source status mappings (SME R13): drafts by source maintainers, approval by the source owner (never
 * the author), versions effective-dated — an approved version ends the open one before it. Imports read
 * the approved version in force; a source without one releases nothing, except the API / file `import`
 * source, which gets the former environment default as version 1 on first use (status quo until its owner
 * approves a new version). Writes need a tenant-wide grant and are audited.
 */
@Injectable()
export class SourceStatusMappingsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async inForce(
    manager: EntityManager,
    tenantId: string,
    sourceSystem: string,
    at: Date,
  ): Promise<SourceStatusMapping | null> {
    const found = await this.approvedAt(manager, tenantId, sourceSystem, at);
    if (found || sourceSystem !== IMPORT_SOURCE) return found;
    const any = await manager.findOneBy(SourceStatusMapping, {
      tenantId,
      sourceSystem,
    });
    if (any) return null;
    await manager.query(
      `INSERT INTO "source_status_mappings" ("tenant_id", "row_version", "source_system", "version", "statuses",
              "effective_from", "state", "approved_at", "notes")
       VALUES ($1, 1, $2, 1, $3::jsonb, '1970-01-01T00:00:00Z', 'approved', now(), $4) ON CONFLICT DO NOTHING`,
      [
        tenantId,
        sourceSystem,
        JSON.stringify(LEGACY_IMPORT_STATUSES),
        LEGACY_NOTE,
      ],
    );
    return this.approvedAt(manager, tenantId, sourceSystem, at);
  }

  /**
   * The versions of the tenant (newest first per source, capped), which one is in force now per source, and
   * the display names of their authors and approvers.
   */
  async list(
    context: RequestContext,
    sourceSystem: string | undefined,
  ): Promise<StatusMappingList> {
    const tenantId = requireTenantId(context);
    const items = await this.dataSource
      .getRepository(SourceStatusMapping)
      .find({
        where: { tenantId, ...(sourceSystem ? { sourceSystem } : {}) },
        order: { sourceSystem: 'ASC', version: 'DESC' },
        take: 200,
      });
    const ids = items
      .flatMap((m) => [m.createdBy, m.approvedBy])
      .filter((id): id is string => typeof id === 'string');
    const names: Array<{ id: string; name: string }> = ids.length
      ? await this.dataSource.query(
          `SELECT "id"::text AS "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])`,
          [[...new Set(ids)]],
        )
      : [];
    return {
      items,
      inForceIds: inForceIdsOf(items, new Date()),
      names: new Map(names.map((n) => [n.id, n.name])),
    };
  }

  create(
    context: RequestContext,
    draft: StatusMappingDraft,
  ): Promise<SourceStatusMapping> {
    const tenantId = requireTenantId(context);
    assertTenantWide(context, 'A source status mapping');
    return this.dataSource.transaction(async (manager) => {
      await this.lockSource(manager, tenantId, draft.sourceSystem);
      const [{ next }] = await manager.query<Array<{ next: number }>>(
        `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "source_status_mappings"
          WHERE "tenant_id" = $1 AND "source_system" = $2`,
        [tenantId, draft.sourceSystem],
      );
      const saved = await manager.save(
        manager.create(SourceStatusMapping, {
          tenantId,
          sourceSystem: draft.sourceSystem,
          version: next,
          statuses: normalized(draft.statuses),
          effectiveFrom: draft.effectiveFrom,
          state: 'draft',
          notes: draft.notes,
          createdBy: context.userId,
        }),
      );
      await this.audit(manager, context, saved, 'created');
      return saved;
    });
  }

  approve(context: RequestContext, id: string): Promise<SourceStatusMapping> {
    const tenantId = requireTenantId(context);
    assertTenantWide(context, 'A source status mapping');
    return this.dataSource.transaction(async (manager) => {
      const mapping = await manager.findOneBy(SourceStatusMapping, {
        id,
        tenantId,
      });
      if (!mapping) throw notFound('Source status mapping');
      if (mapping.state !== 'draft') {
        throw invalidTransition('status mapping', mapping.state, 'approved');
      }
      assertNotAuthor(mapping, context.userId, 'Source status mapping');
      await this.lockSource(manager, tenantId, mapping.sourceSystem);
      await this.closePrevious(manager, mapping);
      await manager.update(SourceStatusMapping, mapping.id, {
        state: 'approved',
        approvedBy: context.userId,
        approvedAt: new Date(),
        updatedBy: context.userId,
      });
      await this.audit(manager, context, mapping, 'approved');
      return manager.findOneByOrFail(SourceStatusMapping, { id: mapping.id });
    });
  }

  private approvedAt(
    manager: EntityManager,
    tenantId: string,
    sourceSystem: string,
    at: Date,
  ): Promise<SourceStatusMapping | null> {
    return manager
      .getRepository(SourceStatusMapping)
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId AND m.sourceSystem = :sourceSystem', {
        tenantId,
        sourceSystem,
      })
      .andWhere(`m.state = 'approved'`)
      .andWhere(
        'm.effectiveFrom <= :at AND (m.effectiveTo IS NULL OR m.effectiveTo > :at)',
        { at },
      )
      .orderBy('m.version', 'DESC')
      .getOne();
  }

  /** The approved version still open ends where the new one starts (it must start later). */
  private async closePrevious(
    manager: EntityManager,
    mapping: SourceStatusMapping,
  ): Promise<void> {
    const open = await manager
      .getRepository(SourceStatusMapping)
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId AND m.sourceSystem = :sourceSystem', {
        tenantId: mapping.tenantId,
        sourceSystem: mapping.sourceSystem,
      })
      .andWhere(`m.state = 'approved' AND m.effectiveTo IS NULL`)
      .getMany();
    for (const previous of open) {
      if (previous.effectiveFrom >= mapping.effectiveFrom) {
        throw invalid(
          'VERSION_OVERLAP',
          `version ${previous.version} starts at or after this one; choose a later effectiveFrom`,
        );
      }
      await manager.update(SourceStatusMapping, previous.id, {
        effectiveTo: mapping.effectiveFrom,
      });
    }
  }

  private async lockSource(
    manager: EntityManager,
    tenantId: string,
    sourceSystem: string,
  ): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `source_status_mapping:${tenantId}:${sourceSystem}`,
    ]);
  }

  private audit(
    manager: EntityManager,
    context: RequestContext,
    mapping: SourceStatusMapping,
    step: 'created' | 'approved',
  ): Promise<void> {
    return appendAudit(manager, [
      {
        tenantId: mapping.tenantId,
        actorId: context.userId,
        action: `source_status_mapping.${step}`,
        entityType: 'source_status_mapping',
        entityId: mapping.id,
        revision: mapping.version,
        correlationId: context.correlationId || null,
        detail: { sourceSystem: mapping.sourceSystem },
      },
    ]);
  }
}

/** Statuses upper-cased and unique (the last entry of a status wins). */
function normalized(
  statuses: readonly SourceStatusEntry[],
): SourceStatusEntry[] {
  const byStatus = new Map<string, boolean>();
  for (const entry of statuses) {
    byStatus.set(entry.status.trim().toUpperCase(), entry.released);
  }
  return [...byStatus.entries()].map(([status, released]) => ({
    status,
    released,
  }));
}
