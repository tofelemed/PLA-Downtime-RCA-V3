import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VALUATION_BASES,
  ValuationBasis,
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { ImpactCode } from '../../impact-code/impact-code.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ProductionProfile } from './production-profile.entity';

/**
 * Effective-dated money per quantity or per hour (spec §14.2 `valuation_rates`, VAL01, D08): a
 * profile's contribution margin or standard cost per `per_uom`, or an impact code's cost per hour; SME V2
 * product values per `per_uom` and the rework yield (recovered per reworked quantity, no currency).
 * Margin versions are kept (GE-style selectable versions); approved versions of one owner and basis
 * never overlap. Used by valuation (2.6).
 */
@Entity('valuation_rates')
@Index('IDX_approval_inbox_valuation_rates', { synchronize: false })
@Exclusion(
  'EX_valuation_rates_approved_no_overlap',
  `USING gist ((COALESCE("profile_id", "impact_code_id")) WITH =, "basis" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_valuation_rates_profile', ['profileId'])
@Index('IDX_valuation_rates_impact_code', ['impactCodeId'])
@Check(
  'CHK_valuation_rates_owner',
  '("profile_id" IS NOT NULL) <> ("impact_code_id" IS NOT NULL)',
)
@Check(
  'CHK_valuation_rates_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check('CHK_valuation_rates_currency', `"currency" ~ '^[A-Z]{3}$'`)
@Check(
  'CHK_valuation_rates_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
@Check(
  'CHK_valuation_rates_ratio_currency',
  `("basis"::text = 'rework_yield') = ("currency" IS NULL)`,
)
@Check(
  'CHK_valuation_rates_yield_range',
  `"basis"::text <> 'rework_yield' OR ("value" > 0 AND "value" <= 1)`,
)
export class ValuationRate extends TenantScopedEntity {
  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @ManyToOne(() => ProductionProfile, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'profile_id' })
  profile?: ProductionProfile | null;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string | null;

  @ManyToOne(() => ImpactCode, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'impact_code_id' })
  impactCode?: ImpactCode | null;

  @Column({
    name: 'basis',
    type: 'enum',
    enum: VALUATION_BASES,
    enumName: 'valuation_rate_basis',
  })
  basis: ValuationBasis;

  @Column({
    name: 'value',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  value: string;

  /** ISO 4217; null only for a ratio basis (`rework_yield`, SME V2 2.8.0) */
  @Column({ name: 'currency', type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  /** quantity unit for quantity bases (= the profile `quantity_uom`); `h` for cost per hour */
  @Column({ name: 'per_uom', type: 'varchar', length: 50 })
  perUom: string;

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
    enumName: 'valuation_rate_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
