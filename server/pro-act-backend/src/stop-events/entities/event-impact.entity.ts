import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { ImpactBasis } from '../../domain/reliability/unit-impact';
import { UnitImpactRule } from '../../plant-model/entities/unit-impact-rule.entity';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * Plan 1.10 `event_impacts`: the derived unit impact of one equipment stop — mode, fraction and where it
 * comes from (a person's statement, the default, the unit impact rule version, or the standby run that
 * took over) — as last resolved. The event row carries the same `impact_mode` / `impact_fraction`, so the
 * ledgers, KPIs and gates all read one impact; this row is its evidence. One row per event.
 */
@Entity('event_impacts')
@Index('UQ_event_impacts_event', ['eventId'], { unique: true })
@Index('IDX_event_impacts_tenant_rule', ['tenantId', 'ruleId'])
@Check(
  'CHK_event_impacts_basis',
  `"basis" IN ('default', 'stated', 'unit_rule', 'standby_takeover')`,
)
export class EventImpact extends TenantOwnedEntity {
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'event_id',
    foreignKeyConstraintName: 'FK_event_impacts_event',
  })
  event?: ProductionEvent;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ name: 'mode', type: 'varchar', length: 16 })
  mode: string;

  @Column({
    name: 'fraction',
    type: 'numeric',
    precision: 9,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  fraction: string | null;

  @Column({ name: 'basis', type: 'varchar', length: 24 })
  basis: ImpactBasis;

  @Column({ name: 'rule_id', type: 'uuid', nullable: true })
  ruleId: string | null;

  @ManyToOne(() => UnitImpactRule, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'rule_id',
    foreignKeyConstraintName: 'FK_event_impacts_rule',
  })
  rule?: UnitImpactRule;

  @Column({ name: 'rule_version', type: 'int', nullable: true })
  ruleVersion: number | null;

  /** the standby run that took over (`standby_records.id`), when the basis is `standby_takeover` */
  @Column({ name: 'standby_record_id', type: 'uuid', nullable: true })
  standbyRecordId: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz' })
  resolvedAt: Date;
}
