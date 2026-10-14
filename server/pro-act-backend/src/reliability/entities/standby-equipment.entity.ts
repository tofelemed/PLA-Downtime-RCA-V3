import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const STANDBY_EVALUATIONS = [
  'demand',
  'running',
  'demand_and_running',
] as const;
export type StandbyEvaluation = (typeof STANDBY_EVALUATIONS)[number];

/**
 * SME D9: an asset evaluated as standby equipment (spare pump, standby compressor) over an interval —
 * maintenance decides whether it is judged on demand (failed starts per demand), on running (operating
 * MTBF from its own running hours) or both. Its standby time is never added to a running MTBF.
 */
@Entity('standby_equipment')
@Index('UQ_standby_equipment_current', ['tenantId', 'assetId'], {
  unique: true,
  where: '"effective_to" IS NULL',
})
@Check(
  'CHK_standby_equipment_interval',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_standby_equipment_evaluation',
  `"evaluation" IN ('demand', 'running', 'demand_and_running')`,
)
export class StandbyEquipment extends TenantScopedEntity {
  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Index('IDX_standby_equipment_unit')
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'evaluation', type: 'varchar', length: 24 })
  evaluation: StandbyEvaluation;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
