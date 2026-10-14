import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { assertRevision } from '../../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { CLASS_BOUND_KINDS } from '../../domain/reliability/failure-dictionary';
import { FailureDictionaryEntry } from '../../reliability/entities/failure-dictionary-entry.entity';
import {
  classInUse,
  entryClosed,
  entryExists,
  entryNotFound,
  invalidDictionaryField,
} from '../../reliability/failure-dictionary/failure-dictionary-errors';
import { inForceAt } from '../../reliability/failure-dictionary/failure-dictionary-reads';
import { listResponse, ListResponse } from '../common/response';
import { writerStamp } from '../master-data/common/master-data-writer';
import { applySearch } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import {
  FailureDictionaryChangeDto,
  FailureDictionaryCreateDto,
  FailureDictionaryListQueryDto,
} from './failure-dictionary-v2.dto';
import {
  FailureDictionaryEntryV2View,
  toDictionaryView,
} from './failure-dictionary-v2.view';

const instant = (value: string | undefined, fallback: Date) =>
  value ? new Date(value) : fallback;

/**
 * The plant's failure dictionary over v2 (SME D11): tenant-wide master data. A change is a new version
 * from its `effectiveFrom` (the old version ends there); a retire ends the entry. Kind, class and code of
 * an entry never change: a different code is a different entry.
 */
@Injectable()
export class FailureDictionaryV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(
    context: RequestContext,
    query: FailureDictionaryListQueryDto,
  ): Promise<ListResponse<FailureDictionaryEntryV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(
      this.manager.getRepository(FailureDictionaryEntry),
      'd',
      { context },
    );
    if (query.kinds?.length) {
      qb.andWhere('d.entryKind IN (:...kinds)', { kinds: query.kinds });
    }
    if (query.equipmentClass !== undefined) {
      qb.andWhere("d.equipmentClass IN (:equipmentClass, '')", {
        equipmentClass: query.equipmentClass,
      });
    }
    if (!query.history) inForceAt(qb, 'd', instant(query.at, new Date()));
    applySearch(qb, 'd', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'd',
      sort: query.sort ?? 'code',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toDictionaryView), page.nextCursor, {
      tenantId,
    });
  }

  async get(
    context: RequestContext,
    id: string,
    manager: EntityManager = this.manager,
  ): Promise<FailureDictionaryEntry> {
    const entry = await scopedQuery(
      manager.getRepository(FailureDictionaryEntry),
      'd',
      { context },
    )
      .andWhere('d.id = :id', { id })
      .getOne();
    if (!entry) throw entryNotFound();
    return entry;
  }

  async create(
    context: RequestContext,
    input: FailureDictionaryCreateDto,
  ): Promise<FailureDictionaryEntry> {
    const stamp = writerStamp(context);
    const equipmentClass = input.equipmentClass?.trim() ?? '';
    if (equipmentClass && !CLASS_BOUND_KINDS.has(input.kind)) {
      throw invalidDictionaryField(
        'equipmentClass',
        'equipmentClass is only allowed on maintainable_item and failure_mode',
      );
    }
    return this.manager.transaction(async (manager) => {
      const code = input.code.trim();
      const key = { kind: input.kind, equipmentClass, code };
      if (await findOpen(manager, stamp.tenantId, key)) throw entryExists(code);
      if (equipmentClass)
        await assertClass(manager, stamp.tenantId, equipmentClass);
      return manager.save(
        manager.create(FailureDictionaryEntry, {
          tenantId: stamp.tenantId,
          entryKind: input.kind,
          equipmentClass,
          code,
          name: input.name.trim(),
          ...contentOf(input),
          effectiveFrom: instant(input.effectiveFrom, new Date()),
          effectiveTo: null,
          createdBy: stamp.actorId,
          updatedBy: stamp.actorId,
        }),
      );
    });
  }

  /** Ends the entry at `effectiveFrom` and starts its next version (If-Match on the entry in force). */
  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: FailureDictionaryChangeDto,
  ): Promise<FailureDictionaryEntry> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const entry = await this.get(context, target.id, manager);
      if (entry.effectiveTo) throw entryClosed();
      assertRevision(entry.rowVersion, target.expectedVersion);
      const from = instant(input.effectiveFrom, new Date());
      assertAfter(entry, from, 'effectiveFrom');
      await manager.update(FailureDictionaryEntry, entry.id, {
        effectiveTo: from,
        updatedBy: stamp.actorId,
      });
      return manager.save(
        manager.create(FailureDictionaryEntry, {
          ...copyOf(entry),
          name: input.name?.trim() ?? entry.name,
          ...contentOf(input, entry),
          effectiveFrom: from,
          effectiveTo: null,
          createdBy: stamp.actorId,
          updatedBy: stamp.actorId,
        }),
      );
    });
  }

  async retire(
    context: RequestContext,
    id: string,
    effectiveTo: string | undefined,
  ): Promise<FailureDictionaryEntry> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const entry = await this.get(context, id, manager);
      if (entry.effectiveTo) throw entryClosed();
      const end = instant(effectiveTo, new Date());
      assertAfter(entry, end, 'effectiveTo');
      if (entry.entryKind === 'equipment_class') {
        const open = await openOfClass(manager, stamp.tenantId, entry.code);
        if (open > 0) throw classInUse(open);
      }
      await manager.update(FailureDictionaryEntry, entry.id, {
        effectiveTo: end,
        updatedBy: stamp.actorId,
      });
      return this.get(context, id, manager);
    });
  }
}

interface EntryKey {
  kind: FailureDictionaryEntry['entryKind'];
  equipmentClass: string;
  code: string;
}

function findOpen(
  manager: EntityManager,
  tenantId: string,
  key: EntryKey,
): Promise<FailureDictionaryEntry | null> {
  return manager
    .getRepository(FailureDictionaryEntry)
    .createQueryBuilder('d')
    .where('d.tenantId = :tenantId AND d.effectiveTo IS NULL', { tenantId })
    .andWhere(
      'd.entryKind = :kind AND d.equipmentClass = :equipmentClass AND d.code = :code',
      key,
    )
    .getOne();
}

/** 422 unless an equipment class of that code is open in the dictionary. */
async function assertClass(
  manager: EntityManager,
  tenantId: string,
  code: string,
): Promise<void> {
  const found = await findOpen(manager, tenantId, {
    kind: 'equipment_class',
    equipmentClass: '',
    code,
  });
  if (!found) {
    throw invalidDictionaryField(
      'equipmentClass',
      `equipment class ${code} is not in the dictionary`,
    );
  }
}

async function openOfClass(
  manager: EntityManager,
  tenantId: string,
  classCode: string,
): Promise<number> {
  const rows = await manager.query<Array<{ n: number }>>(
    `SELECT count(*)::int AS "n" FROM "failure_dictionary_entries"
      WHERE "tenant_id" = $1 AND "equipment_class" = $2 AND "effective_to" IS NULL`,
    [tenantId, classCode],
  );
  return rows[0]?.n ?? 0;
}

function assertAfter(
  entry: FailureDictionaryEntry,
  instantValue: Date,
  field: string,
): void {
  if (instantValue <= entry.effectiveFrom) {
    throw invalidDictionaryField(
      field,
      `${field} must be after the start of the entry in force (${entry.effectiveFrom.toISOString()})`,
    );
  }
}

type Content = Pick<
  FailureDictionaryEntry,
  'description' | 'category' | 'assetTypes' | 'isPending'
>;

/** Content fields of a body; on a change, absent fields keep the entry's value (`null` clears). */
function contentOf(
  input: {
    description?: string | null;
    category?: string | null;
    assetTypes?: string[];
    isPending?: boolean;
  },
  base?: FailureDictionaryEntry,
): Content {
  const textOf = (value: string | null | undefined, kept: string | null) =>
    value === undefined ? kept : value?.trim() || null;
  return {
    description: textOf(input.description, base?.description ?? null),
    category: textOf(input.category, base?.category ?? null),
    assetTypes: input.assetTypes
      ? [...new Set(input.assetTypes.map((t) => t.trim()).filter(Boolean))]
      : (base?.assetTypes ?? []),
    isPending: input.isPending ?? base?.isPending ?? false,
  };
}

function copyOf(
  entry: FailureDictionaryEntry,
): Partial<FailureDictionaryEntry> {
  return {
    tenantId: entry.tenantId,
    entryKind: entry.entryKind,
    equipmentClass: entry.equipmentClass,
    code: entry.code,
  };
}
