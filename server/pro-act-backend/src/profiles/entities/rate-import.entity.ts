import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  RATE_IMPORT_KINDS,
  RATE_IMPORT_STATES,
  RateImportKind,
  RateImportState,
} from '../../domain/profiles/profile.types';
import {
  ImportRowError,
  ImportRowInput,
} from '../../domain/profiles/rate-import-rows';

/** What the request delivered: JSON rows or a CSV text with the same column names. */
export interface RateImportPayload {
  rows?: ImportRowInput[];
  csv?: string;
}

export interface RateImportCounts {
  rows: number;
  inserted: number;
  retired: number;
  errors: number;
}

/**
 * One delivery of a budget, forecast or MPC document (spec §14.2 `rate_imports`, PLAN06). `external_id`
 * names the document; each delivery is its next `revision`, and a revision is a **correction**: the
 * rows of earlier revisions are retired and replaced, never added to. Processed by the worker (202 job);
 * a document with any invalid row is refused whole and its `report` lists every error.
 */
@Entity('rate_imports')
@Unique('UQ_rate_imports_document_revision', [
  'tenantId',
  'kind',
  'externalId',
  'revision',
])
@Index('IDX_rate_imports_state_created', ['state', 'createdAt'])
export class RateImport extends TenantScopedEntity {
  @Column({
    name: 'kind',
    type: 'enum',
    enum: RATE_IMPORT_KINDS,
    enumName: 'rate_import_kind',
  })
  kind: RateImportKind;

  @Column({ name: 'external_id', type: 'varchar', length: 255 })
  externalId: string;

  @Column({ name: 'revision', type: 'int' })
  revision: number;

  /** name of the delivered file, as given by the caller */
  @Column({ name: 'file_ref', type: 'varchar', length: 500, nullable: true })
  fileRef: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: RATE_IMPORT_STATES,
    enumName: 'rate_import_state',
    default: 'queued',
  })
  state: RateImportState;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: RateImportPayload;

  @Column({ name: 'counts', type: 'jsonb', nullable: true })
  counts: RateImportCounts | null;

  @Column({ name: 'report', type: 'jsonb', nullable: true })
  report: ImportRowError[] | null;

  @Column({ name: 'imported_by', type: 'uuid', nullable: true })
  importedBy: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
