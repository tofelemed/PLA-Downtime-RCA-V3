import { Check, Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const STATUS_MAPPING_STATES = ['draft', 'approved', 'retired'] as const;
export type StatusMappingState = (typeof STATUS_MAPPING_STATES)[number];

/** One source workflow status and whether it is the authorised final (released) record. */
export interface SourceStatusEntry {
  status: string;
  released: boolean;
}

/**
 * Per-source status mapping (SME R13): which workflow statuses of one source system mean the record is
 * released (e.g. a LIMS's AUTHORIZED, not COMPLETED). Versioned and effective-dated `[from, to)`; a version
 * counts only once the source owner approved it (never its author). Replaces the
 * `EXTERNAL_REPORT_CERTIFIED_STATUSES` environment list.
 */
@Entity('source_status_mappings')
@Index('IDX_approval_inbox_source_status_mappings', { synchronize: false })
@Unique('UQ_source_status_mappings_version', [
  'tenantId',
  'sourceSystem',
  'version',
])
@Index('IDX_source_status_mappings_lookup', [
  'tenantId',
  'sourceSystem',
  'effectiveFrom',
])
@Check(
  'CHK_source_status_mappings_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_source_status_mappings_state',
  `"state" IN ('draft', 'approved', 'retired')`,
)
export class SourceStatusMapping extends TenantScopedEntity {
  @Column({ name: 'source_system', type: 'varchar', length: 64 })
  sourceSystem: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'statuses', type: 'jsonb' })
  statuses: SourceStatusEntry[];

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'state', type: 'varchar', length: 16, default: 'draft' })
  state: StatusMappingState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
