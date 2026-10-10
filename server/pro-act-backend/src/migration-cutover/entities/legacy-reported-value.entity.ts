import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A value the v1 screens let users type (losses, reconcile amounts, OEE) kept as reported, never as a
 * recalculated or approved figure (spec §18.2 "client-entered loss / OEE"): `method` is always
 * `UnknownLegacy`. Currency and quantity unit are unknown for these rows (see the `units` job).
 */
@Entity('legacy_reported_values')
@Unique('UQ_legacy_reported_values', ['legacyTable', 'legacyId', 'metric'])
@Index('IDX_legacy_reported_values_tenant_plan', ['tenantId', 'planId'])
@Index('IDX_legacy_reported_values_report', ['reportId'])
@Check('CHK_legacy_reported_values_method', `"method" = 'UnknownLegacy'`)
export class LegacyReportedValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'legacy_table', type: 'varchar', length: 64 })
  legacyTable: string;

  @Column({ name: 'legacy_id', type: 'uuid' })
  legacyId: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'period_label', type: 'varchar', length: 50, nullable: true })
  periodLabel: string | null;

  @Column({ name: 'metric', type: 'varchar', length: 64 })
  metric: string;

  @Column({ name: 'value', type: 'numeric', precision: 24, scale: 8 })
  value: number;

  @Column({ name: 'method', type: 'varchar', length: 16 })
  method: 'UnknownLegacy';

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
