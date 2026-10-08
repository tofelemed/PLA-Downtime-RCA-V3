import { EntityManager, IsNull } from 'typeorm';
import { CodeLibraryKind } from './code-library-kind';
import { CodeRow } from './code-library.descriptors';
import { CodeVersion } from './code-version.entity';
import { codeSnapshot, toCodeView } from './code-view';

/** Appends and closes `code_versions` rows inside the caller's transaction (plan 1.3). */

export interface VersionStamp {
  tenantId: string;
  actorId: string | null;
  at: Date;
}

/** Records `row` (as it is now) as version `row.version`, effective from `stamp.at`. */
export async function appendVersion(
  manager: EntityManager,
  library: CodeLibraryKind,
  row: CodeRow,
  stamp: VersionStamp,
): Promise<void> {
  await manager.getRepository(CodeVersion).insert({
    tenantId: stamp.tenantId,
    library,
    codeId: row.id,
    version: row.version,
    code: row.code,
    name: row.name,
    parentId: row.parentId ?? null,
    snapshot: codeSnapshot(toCodeView(library, row, stamp.at)),
    effectiveFrom: stamp.at,
    effectiveTo: null,
    createdBy: stamp.actorId,
    updatedBy: stamp.actorId,
  });
}

/** Ends the open version of a code at `at`. */
export async function closeOpenVersion(
  manager: EntityManager,
  library: CodeLibraryKind,
  codeId: string,
  at: Date,
): Promise<void> {
  await manager
    .getRepository(CodeVersion)
    .update({ library, codeId, effectiveTo: IsNull() }, { effectiveTo: at });
}

/**
 * Codes created through v1 after the backfill have no history yet: their current state becomes the
 * baseline version before the first v2 change.
 */
export async function ensureBaselineVersion(
  manager: EntityManager,
  library: CodeLibraryKind,
  row: CodeRow,
  stamp: VersionStamp,
): Promise<void> {
  const exists = await manager
    .getRepository(CodeVersion)
    .existsBy({ library, codeId: row.id, version: row.version });
  if (!exists) {
    await appendVersion(manager, library, row, {
      ...stamp,
      at: row.effectiveFrom ?? stamp.at,
    });
  }
}
