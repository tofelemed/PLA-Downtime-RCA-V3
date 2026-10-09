import { Check, Column, Entity, Exclusion, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * Approved, dated FX rate table of plan 2.6 (D08 2026-10-09: IRR and USD; VAL03): `1 from_currency =
 * rate to_currency` over `[effective_from, effective_to)`, versioned per currency pair like master data
 * (draft → approved → retired, approved versions of a pair never overlap). Valuation converts with the
 * approved version in force on the valuation date and records its id; without one the amount is null.
 */
@Entity('fx_rates')
@Exclusion(
  'EX_fx_rates_approved_no_overlap',
  `USING gist ("tenant_id" WITH =, "from_currency" WITH =, "to_currency" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_fx_rates_tenant_pair_from', [
  'tenantId',
  'fromCurrency',
  'toCurrency',
  'effectiveFrom',
])
@Check(
  'CHK_fx_rates_currencies',
  `"from_currency" ~ '^[A-Z]{3}$' AND "to_currency" ~ '^[A-Z]{3}$' AND "from_currency" <> "to_currency"`,
)
@Check('CHK_fx_rates_rate_positive', '"rate" > 0')
@Check(
  'CHK_fx_rates_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_fx_rates_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class FxRate extends TenantScopedEntity {
  @Column({ name: 'from_currency', type: 'varchar', length: 3 })
  fromCurrency: string;

  @Column({ name: 'to_currency', type: 'varchar', length: 3 })
  toCurrency: string;

  @Column({
    name: 'rate',
    type: 'numeric',
    precision: 24,
    scale: 10,
    transformer: decimalStringTransformer,
  })
  rate: string;

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
    enumName: 'fx_rate_state',
    default: 'draft',
  })
  state: VersionState;

  /** where the rate comes from (e.g. central bank fixing, treasury) — free text, never interpreted */
  @Column({ name: 'source', type: 'text', nullable: true })
  source: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
