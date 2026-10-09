import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';

export const LINE_SET_ORIGINS = [
  'draft_save',
  'submit_tolerance',
  'revise_copy',
] as const;
export type LineSetOrigin = (typeof LINE_SET_ORIGINS)[number];

/**
 * One saved version of a revision's reconciliation (plan 2.8, ACC07/ACC08, §15.3): the full set of
 * decisions on automatic candidates and manual lines, against the calculation run the editor saw
 * (`base_run_id`). Every save writes a new set and moves the revision's `current_line_set_id` in the
 * same transaction, so a failed save leaves the previous set current (T33). Immutable.
 */
@Entity('reconciliation_line_sets')
@Unique('UQ_reconciliation_line_sets_revision_version', [
  'revisionId',
  'version',
])
@Index('IDX_reconciliation_line_sets_base_run', ['baseRunId'])
@Index('IDX_reconciliation_line_sets_tenant_period', ['tenantId', 'periodId'])
export class ReconciliationLineSet extends TenantScopedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_reconciliation_line_sets_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_reconciliation_line_sets_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'base_run_id', type: 'uuid' })
  baseRunId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'base_run_id',
    foreignKeyConstraintName: 'FK_reconciliation_line_sets_base_run',
  })
  baseRun?: CalculationRun;

  @Column({ name: 'origin', type: 'varchar', length: 32 })
  origin: LineSetOrigin;
}
