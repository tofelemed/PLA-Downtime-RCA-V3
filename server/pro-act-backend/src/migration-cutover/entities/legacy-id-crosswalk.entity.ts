import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Legacy-id mapping (spec MIG02, §14.3): which new-model row a legacy row corresponds to and how
 * (`relation`: `explains_event`, `duplicate_of`, `period_day`, `period_instant`). Maintained by the
 * remediation jobs; only rows reconstructed from explicit legacy ids or unambiguous keys are written.
 */
@Entity('legacy_id_crosswalk')
@Unique('UQ_legacy_id_crosswalk', [
  'legacyTable',
  'legacyId',
  'newTable',
  'newId',
  'relation',
])
@Index('IDX_legacy_id_crosswalk_new', ['newTable', 'newId'])
@Index('IDX_legacy_id_crosswalk_tenant', ['tenantId'])
@Index('IDX_legacy_id_crosswalk_report', ['reportId'])
export class LegacyIdCrosswalk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'legacy_table', type: 'varchar', length: 64 })
  legacyTable: string;

  @Column({ name: 'legacy_id', type: 'varchar', length: 255 })
  legacyId: string;

  @Column({ name: 'new_table', type: 'varchar', length: 64 })
  newTable: string;

  @Column({ name: 'new_id', type: 'uuid' })
  newId: string;

  @Column({ name: 'relation', type: 'varchar', length: 32 })
  relation: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
