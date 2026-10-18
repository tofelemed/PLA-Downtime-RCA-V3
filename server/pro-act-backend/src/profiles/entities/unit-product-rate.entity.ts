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
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RateTimebase } from '../../domain/actuals/actuals.types';
import {
  RATE_KINDS,
  RATE_SOURCES,
  RATE_TIMEBASES,
  RateKind,
  RateSource,
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ProductionProfile } from './production-profile.entity';
import { RateImport } from './rate-import.entity';

/**
 * One effective-dated rate of a profile (spec §14.2 `unit_product_rates`, PLAN01/PLAN06): nameplate,
 * demonstrated, sustained (MSC/MPC), planning, budget and forecast are separate kinds. Approved versions
 * of one profile and kind never overlap (exclusion constraint); corrections are new versions — an
 * approved row is only closed at its successor's `from` (supersede) or retired.
 */
@Entity('unit_product_rates')
@Index('IDX_approval_inbox_unit_product_rates', { synchronize: false })
@Unique('UQ_unit_product_rates_profile_kind_version', [
  'profileId',
  'rateKind',
  'version',
])
@Exclusion(
  'EX_unit_product_rates_approved_no_overlap',
  `USING gist ("profile_id" WITH =, "rate_kind" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_unit_product_rates_tenant_kind_external', [
  'tenantId',
  'rateKind',
  'externalId',
])
@Index('IDX_unit_product_rates_import', ['rateImportId'])
@Check(
  'CHK_unit_product_rates_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check('CHK_unit_product_rates_rate', '"rate" >= 0')
@Check(
  'CHK_unit_product_rates_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class UnitProductRate extends TenantScopedEntity {
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => ProductionProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'profile_id' })
  profile?: ProductionProfile;

  @Column({
    name: 'rate_kind',
    type: 'enum',
    enum: RATE_KINDS,
    enumName: 'unit_product_rate_kind',
  })
  rateKind: RateKind;

  /** quantity (profile `quantity_uom`) per `timebase`, decimal string */
  @Column({
    name: 'rate',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  rate: string;

  @Column({
    name: 'timebase',
    type: 'enum',
    enum: RATE_TIMEBASES,
    enumName: 'unit_product_rate_timebase',
  })
  timebase: RateTimebase;

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
    enumName: 'unit_product_rate_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({
    name: 'source',
    type: 'enum',
    enum: RATE_SOURCES,
    enumName: 'unit_product_rate_source',
    default: 'manual',
  })
  source: RateSource;

  /** imported rows: the import document's external id (a revision of it retires these rows) */
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ name: 'rate_import_id', type: 'uuid', nullable: true })
  rateImportId: string | null;

  @ManyToOne(() => RateImport, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'rate_import_id' })
  rateImport?: RateImport | null;
}
