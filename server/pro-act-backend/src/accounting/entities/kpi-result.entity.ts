import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  KPI_METRICS,
  KPI_QUALITIES,
  KpiCohort,
  KpiMetric,
  KpiQuality,
  KpiScope,
  KpiUnit,
} from '../../domain/kpi/kpi.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { CalculationRun } from './calculation-run.entity';

const term = (name: string, scale: number) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale,
  nullable: true,
  transformer: decimalStringTransformer,
});

/**
 * One KPI of a calculation run (plan 2.7, §14.2 `kpi_results`): explicit numerator and denominator, the
 * value (null with a reason when not computable), its quality and cohort, for a scope (period, product
 * slice, asset or downtime-breakdown cell). Written with the run and immutable; reports sum the stored
 * numerators and denominators of the shown runs (AN03), never the values.
 */
@Entity('kpi_results')
@Index('IDX_kpi_results_tenant_run_metric', ['tenantId', 'runId', 'metric'])
@Index('IDX_kpi_results_run', ['runId'])
export class KpiResult extends TenantOwnedEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'FK_kpi_results_run',
  })
  run?: CalculationRun;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'scope', type: 'jsonb' })
  scope: KpiScope;

  @Column({
    name: 'metric',
    type: 'enum',
    enum: KPI_METRICS,
    enumName: 'kpi_metric',
  })
  metric: KpiMetric;

  /** the `oee_policy` version the run applied */
  @Column({ name: 'policy_id', type: 'uuid', nullable: true })
  policyId: string | null;

  @Column(term('numerator', 8))
  numerator: string | null;

  @Column(term('denominator', 8))
  denominator: string | null;

  @Column(term('value', 10))
  value: string | null;

  @Column({ name: 'unit', type: 'varchar', length: 8 })
  unit: KpiUnit;

  @Column({
    name: 'quality',
    type: 'enum',
    enum: KPI_QUALITIES,
    enumName: 'kpi_quality',
  })
  quality: KpiQuality;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'cohort', type: 'jsonb', nullable: true })
  cohort: KpiCohort | null;

  @Column({ name: 'as_of', type: 'timestamptz' })
  asOf: Date;
}
