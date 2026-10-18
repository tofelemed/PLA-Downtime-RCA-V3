import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, QueryFailedError } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { CodeLibraryKind } from './code-library-kind';
import {
  CODE_LIBRARY_DESCRIPTORS,
  CodeExtras,
  CodeRow,
} from './code-library.descriptors';
import { CodeLibraryService, fieldNotAllowed } from './code-library.service';
import {
  codeCycle,
  codeExists,
  codeHasChildren,
  codeReferences,
  codeRetired,
  invalidReference,
} from './code-references';
import {
  isValidFailureParent,
  pathOf,
  placement,
  wouldCycle,
} from './code-tree';
import {
  appendVersion,
  closeOpenVersion,
  ensureBaselineVersion,
  VersionStamp,
} from './code-version-log';
import { CodeV2View, toCodeView } from './code-view';

export interface CodeCreateInput extends CodeExtras {
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  effectiveFrom?: string;
}

export type CodeUpdateInput = Omit<
  CodeCreateInput,
  'code' | 'name' | 'groupKind' | 'effectiveFrom'
> & { name?: string };

/** One UPDATE of a code row. */
interface CodeWrite {
  id: string;
  changes: Partial<CodeRow>;
  actorId: string | null;
}

/** Caller, library and transaction a write runs in. */
interface WriteScope {
  context: RequestContext;
  library: CodeLibraryKind;
  manager: EntityManager;
}

const UNIQUE_VIOLATION = '23505';
const COMMON_FIELDS = new Set([
  'code',
  'name',
  'description',
  'parentId',
  'effectiveFrom',
]);

/**
 * Writes of the code libraries (plan 1.3, T18): create, change (= a new version, `If-Match` on the
 * current version), retire. Trees stay acyclic and inside one tenant and library; every change appends
 * to `code_versions`; retiring a code with active children is 409 with reference counts.
 */
@Injectable()
export class CodeLibraryCommandService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly reads: CodeLibraryService,
  ) {}

  async create(
    context: RequestContext,
    library: CodeLibraryKind,
    input: CodeCreateInput,
  ): Promise<CodeV2View> {
    assertFields(library, input);
    const stamp = stampOf(context, input.effectiveFrom);
    try {
      return await this.manager.transaction(async (manager) => {
        await this.assertCodeFree(context, library, input, manager);
        const parent = await this.parentFor(context, library, input, manager);
        await this.assertDefaults(stamp.tenantId, input, manager);
        const id = randomUUID();
        const row = this.repository(library, manager).create({
          ...extrasOf(library, input),
          id,
          tenantId: stamp.tenantId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          ...(CODE_LIBRARY_DESCRIPTORS[library].hierarchical
            ? { parentId: parent?.id ?? null, ...placement(id, parent) }
            : {}),
          version: 1,
          effectiveFrom: stamp.at,
          isActive: true,
          createdBy: stamp.actorId,
          updatedBy: stamp.actorId,
        });
        await this.repository(library, manager).insert(row);
        await appendVersion(manager, library, row, stamp);
        return toCodeView(
          library,
          await this.reads.find(context, library, id, manager),
        );
      });
    } catch (error) {
      throw isUniqueViolation(error) ? codeExists(input.code) : error;
    }
  }

  /** A change is the next version; a parent change re-paths the whole subtree. */
  async update(
    context: RequestContext,
    library: CodeLibraryKind,
    target: { id: string; expectedVersion: number },
    input: CodeUpdateInput,
  ): Promise<CodeV2View> {
    assertFields(library, input);
    const stamp = stampOf(context);
    return this.manager.transaction(async (manager) => {
      const row = await this.locked(context, library, target.id, manager);
      assertRevision(row.version, target.expectedVersion);
      if (isRetired(row, stamp.at)) throw codeRetired();
      await this.assertDefaults(stamp.tenantId, input, manager);
      await ensureBaselineVersion(manager, library, row, stamp);
      const moved = await this.moveIfReparented(
        { context, library, manager },
        row,
        input,
      );
      const changes = {
        ...extrasOf(library, input),
        ...definedOnly({ name: input.name, description: input.description }),
        ...moved,
        version: row.version + 1,
      };
      await this.write(manager, library, {
        id: row.id,
        changes,
        actorId: stamp.actorId,
      });
      await closeOpenVersion(manager, library, row.id, stamp.at);
      const updated = await this.reads.find(context, library, row.id, manager);
      await appendVersion(manager, library, updated, stamp);
      return toCodeView(library, updated);
    });
  }

  async retire(
    context: RequestContext,
    library: CodeLibraryKind,
    id: string,
    effectiveTo?: string,
  ): Promise<CodeV2View> {
    const stamp = stampOf(context, effectiveTo);
    return this.manager.transaction(async (manager) => {
      const row = await this.locked(context, library, id, manager);
      if (isRetired(row, new Date())) throw codeRetired();
      const references = await codeReferences(manager, library, row);
      if (references.activeChildren > 0) throw codeHasChildren(references);
      await ensureBaselineVersion(manager, library, row, stamp);
      const retiredNow = stamp.at.getTime() <= Date.now();
      await this.write(manager, library, {
        id,
        changes: {
          effectiveTo: stamp.at,
          isActive: retiredNow ? false : row.isActive,
        },
        actorId: stamp.actorId,
      });
      await closeOpenVersion(manager, library, id, stamp.at);
      return toCodeView(
        library,
        await this.reads.find(context, library, id, manager),
      );
    });
  }

  /** UPDATE of one code; `updated_by` only on tables that have it (the new TenantScopedEntity ones). */
  private async write(
    manager: EntityManager,
    library: CodeLibraryKind,
    { id, changes, actorId }: CodeWrite,
  ): Promise<void> {
    const repository = this.repository(library, manager);
    const audited = repository.metadata.findColumnWithPropertyName('updatedBy');
    await repository.update(
      { id },
      audited ? { ...changes, updatedBy: actorId } : changes,
    );
  }

  private repository(library: CodeLibraryKind, manager: EntityManager) {
    return manager.getRepository<CodeRow>(
      CODE_LIBRARY_DESCRIPTORS[library].entity,
    );
  }

  private locked(
    context: RequestContext,
    library: CodeLibraryKind,
    id: string,
    manager: EntityManager,
  ): Promise<CodeRow> {
    return this.reads
      .scoped(context, library, manager)
      .andWhere('code.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne()
      .then((row) => row ?? this.reads.find(context, library, id, manager));
  }

  private async assertCodeFree(
    context: RequestContext,
    library: CodeLibraryKind,
    input: CodeCreateInput,
    manager: EntityManager,
  ): Promise<void> {
    const qb = this.reads
      .scoped(context, library, manager)
      .andWhere('code.code = :code', { code: input.code });
    if (library === 'failure') {
      qb.andWhere('code.groupKind = :groupKind', {
        groupKind: input.groupKind,
      });
    }
    if ((await qb.getCount()) > 0) throw codeExists(input.code);
  }

  /** The parent of a new code: same tenant and library, not retired, valid failure level. */
  private async parentFor(
    context: RequestContext,
    library: CodeLibraryKind,
    input: Pick<CodeCreateInput, 'parentId' | 'groupKind'>,
    manager: EntityManager,
  ): Promise<CodeRow | null> {
    const parent = input.parentId
      ? await this.reads
          .scoped(context, library, manager)
          .andWhere('code.id = :parentId', { parentId: input.parentId })
          .getOne()
      : null;
    if (input.parentId && (!parent || isRetired(parent, new Date()))) {
      throw invalidReference(
        'parentId',
        'parentId is not an active code of this library and tenant',
      );
    }
    if (library === 'failure' && input.groupKind) {
      if (!isValidFailureParent(input.groupKind, parent?.groupKind ?? null)) {
        throw invalidReference(
          'parentId',
          'a failure group sits one level below its parent (class → problem → cause → remedy)',
        );
      }
    }
    return parent;
  }

  /** New parent → cycle check, then the node and its descendants get new paths and levels. */
  private async moveIfReparented(
    { context, library, manager }: WriteScope,
    row: CodeRow,
    input: CodeUpdateInput,
  ): Promise<Partial<CodeRow>> {
    if (
      input.parentId === undefined ||
      input.parentId === (row.parentId ?? null)
    )
      return {};
    const parent = await this.parentFor(
      context,
      library,
      { parentId: input.parentId, groupKind: row.groupKind },
      manager,
    );
    if (parent && wouldCycle(row.id, parent)) throw codeCycle();
    const next = placement(row.id, parent);
    const table = this.repository(library, manager).metadata.tableName;
    await manager.query(
      `UPDATE "${table}" SET "path" = $1 || substr("path", length($2) + 1), "level" = "level" + $3
        WHERE "tenant_id" = $4 AND "path" LIKE $2 || '/%'`,
      [next.path, pathOf(row), next.level - (row.level ?? 0), row.tenantId],
    );
    return { parentId: parent?.id ?? null, ...next };
  }

  private async assertDefaults(
    tenantId: string,
    input: CodeExtras,
    manager: EntityManager,
  ): Promise<void> {
    if (!input.defaultImpactCodeId) return;
    const owned = await manager
      .getRepository(ImpactCode)
      .existsBy({ id: input.defaultImpactCodeId, tenantId });
    if (!owned) {
      throw invalidReference(
        'defaultImpactCodeId',
        'defaultImpactCodeId is not an impact code of this tenant',
      );
    }
  }
}

function assertFields(library: CodeLibraryKind, input: object): void {
  const descriptor = CODE_LIBRARY_DESCRIPTORS[library];
  for (const [field, value] of Object.entries(input)) {
    if (value === undefined || COMMON_FIELDS.has(field)) continue;
    if (!(descriptor.extraFields as readonly string[]).includes(field)) {
      throw fieldNotAllowed(library, field);
    }
  }
  const record = input as Partial<CodeCreateInput>;
  if (record.parentId && !descriptor.hierarchical)
    throw fieldNotAllowed(library, 'parentId');
  if (library === 'failure' && 'code' in record && !record.groupKind) {
    throw fieldNotAllowed(library, 'groupKind (required)');
  }
}

function extrasOf(
  library: CodeLibraryKind,
  input: CodeExtras,
): Partial<CodeRow> {
  const allowed = CODE_LIBRARY_DESCRIPTORS[library]
    .extraFields as readonly string[];
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => allowed.includes(key) && value !== undefined,
    ),
  );
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function isRetired(row: CodeRow, at: Date): boolean {
  return (
    !row.isActive ||
    (row.effectiveTo !== null &&
      row.effectiveTo !== undefined &&
      row.effectiveTo <= at)
  );
}

/** Codes are tenant-wide: a unit-limited writer gets 403 TENANT_SCOPE_REQUIRED (plan 3.8). */
function stampOf(context: RequestContext, at?: string): VersionStamp {
  const tenantId = requireTenantId(context);
  assertTenantWideWriter(context, tenantId);
  return {
    tenantId,
    actorId: context.userId,
    at: at ? new Date(at) : new Date(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}
