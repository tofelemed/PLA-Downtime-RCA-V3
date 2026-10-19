import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CodeLibraryKind } from './code-library-kind';
import { CODE_LIBRARY_DESCRIPTORS, CodeRow } from './code-library.descriptors';
import { plural } from '../common/helpers/plural';

/** What still points at a code (retire answers 409 with these counts, T18). */
export interface CodeReferences {
  activeChildren: number;
  events: number;
  mappingRules: number;
}

export async function codeReferences(
  manager: EntityManager,
  library: CodeLibraryKind,
  row: CodeRow,
): Promise<CodeReferences> {
  const descriptor = CODE_LIBRARY_DESCRIPTORS[library];
  const table = manager.getRepository(descriptor.entity).metadata.tableName;
  const count = async (sql: string, params: unknown[]): Promise<number> => {
    const rows: Array<{ count: number }> = await manager.query(sql, params);
    return rows[0]?.count ?? 0;
  };
  const activeChildren = descriptor.hierarchical
    ? await count(
        `SELECT count(*)::int AS count FROM "${table}"
          WHERE "parent_id" = $1 AND "is_active" AND ("effective_to" IS NULL OR "effective_to" > now())`,
        [row.id],
      )
    : 0;
  const events = descriptor.eventColumn
    ? await count(
        `SELECT count(*)::int AS count FROM "production_events" WHERE "${descriptor.eventColumn}" = $1`,
        [row.id],
      )
    : 0;
  const mappingRules = await count(
    `SELECT count(*)::int AS count FROM "code_mapping_rules"
      WHERE "tenant_id" = $1 AND ("source_code_id" = $2 OR "target_code_id" = $2)`,
    [row.tenantId, row.id],
  );
  return { activeChildren, events, mappingRules };
}

export function codeHasChildren(references: CodeReferences): ConflictException {
  return new ConflictException({
    code: 'CODE_HAS_CHILDREN',
    message: `The code has ${plural(references.activeChildren, 'active child code', 'active child codes')}; retire or move them first`,
    details: { references },
  });
}

export function codeRetired(): ConflictException {
  return new ConflictException({
    code: 'CODE_RETIRED',
    message: 'The code is retired',
  });
}

export function codeExists(code: string): ConflictException {
  return new ConflictException({
    code: 'CODE_EXISTS',
    message: `A code "${code}" already exists in this library for the tenant`,
  });
}

export function invalidReference(
  field: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

export function codeCycle(): UnprocessableEntityException {
  const message = 'parentId would make the code its own ancestor';
  return new UnprocessableEntityException({
    code: 'CODE_CYCLE',
    message: [message],
    fieldErrors: [{ field: 'parentId', message }],
  });
}
