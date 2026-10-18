import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Asset } from '../../asset/asset.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { UnitImpactMode } from '../../domain/reliability/unit-impact';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * Plan 1.10 step 4 / SME Q5 + D9: how a stop of one asset affects its unit — `full_stop` (the unit stops),
 * `fractional` (one of several trains: the unit loses `fraction` of its rate) or `none` (the unit keeps
 * running) — and the installed standby whose successful start within `takeoverSeconds` holds the output.
 * Effective-dated, versioned per (unit, asset) like rates: maker-checker, supersede, no overlapping
 * approved version. Stops whose impact a person stated keep it (the manual override).
 */
@Entity('unit_impact_rules')
@Index('IDX_approval_inbox_unit_impact_rules', { synchronize: false })
@Unique('UQ_unit_impact_rules_version', ['unitId', 'assetId', 'version'])
@Exclusion(
  'EX_unit_impact_rules_approved_no_overlap',
  `USING gist ("unit_id" WITH =, "asset_id" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) ` +
    `WHERE ("state" = 'approved')`,
)
@Index('IDX_unit_impact_rules_tenant_unit_asset', [
  'tenantId',
  'unitId',
  'assetId',
])
@Index('IDX_unit_impact_rules_standby', ['standbyAssetId'], {
  where: '"standby_asset_id" IS NOT NULL',
})
@Check(
  'CHK_unit_impact_rules_mode',
  `"mode" IN ('full_stop', 'fractional', 'none')`,
)
@Check(
  'CHK_unit_impact_rules_fraction',
  `("mode" = 'fractional') = ("fraction" IS NOT NULL) AND ("fraction" IS NULL OR ("fraction" > 0 AND "fraction" <= 1))`,
)
@Check(
  'CHK_unit_impact_rules_standby',
  `"standby_asset_id" IS NULL OR "standby_asset_id" <> "asset_id"`,
)
@Check('CHK_unit_impact_rules_takeover', '"takeover_seconds" >= 0')
@Check(
  'CHK_unit_impact_rules_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_unit_impact_rules_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class UnitImpactRule extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_unit_impact_rules_unit',
  })
  unit?: Unit;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @ManyToOne(() => Asset, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'asset_id',
    foreignKeyConstraintName: 'FK_unit_impact_rules_asset',
  })
  asset?: Asset;

  @Column({ name: 'mode', type: 'varchar', length: 16 })
  mode: UnitImpactMode;

  /** share of the unit's rate lost, 0 < f ≤ 1, only with `fractional` */
  @Column({
    name: 'fraction',
    type: 'numeric',
    precision: 9,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  fraction: string | null;

  @Column({ name: 'standby_asset_id', type: 'uuid', nullable: true })
  standbyAssetId: string | null;

  @ManyToOne(() => Asset, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'standby_asset_id',
    foreignKeyConstraintName: 'FK_unit_impact_rules_standby_asset',
  })
  standbyAsset?: Asset;

  @Column({ name: 'takeover_seconds', type: 'int', default: 60 })
  takeoverSeconds: number;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({
    name: 'state',
    type: 'enum',
    enum: VERSION_STATES,
    enumName: 'unit_impact_rule_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
