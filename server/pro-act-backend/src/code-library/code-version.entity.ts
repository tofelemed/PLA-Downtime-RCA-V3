import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import { CODE_LIBRARIES, CodeLibraryKind } from './code-library-kind';

/** Snapshot of a code at one version; values are strings, numbers, booleans or null. */
export type CodeSnapshot = Record<string, string | number | boolean | null>;

/**
 * Immutable version history of every code library (spec §14.2 code versions, plan 1.3). A code row keeps
 * its stable id and its current `version`; each change appends a row here with the full snapshot, so
 * `event_coding` can point at the exact version a user chose. `code_id` is polymorphic over the libraries
 * (`library` says which table), hence no foreign key on it.
 */
@Entity('code_versions')
@Unique('UQ_code_versions_library_code_version', [
  'library',
  'codeId',
  'version',
])
@Index('IDX_code_versions_tenant_code', ['tenantId', 'codeId'])
export class CodeVersion extends TenantScopedEntity {
  @Column({
    name: 'library',
    type: 'enum',
    enum: CODE_LIBRARIES,
    enumName: 'code_library_kind',
  })
  library: CodeLibraryKind;

  @Column({ name: 'code_id', type: 'uuid' })
  codeId: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'code', type: 'varchar', length: 255 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'snapshot', type: 'jsonb' })
  snapshot: CodeSnapshot;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
