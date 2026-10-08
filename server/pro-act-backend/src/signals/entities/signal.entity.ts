import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const SIGNAL_SEMANTIC_TYPES = [
  'rate',
  'counter',
  'state',
  'quality',
  'level',
  'output_increment',
  'other',
] as const;
export type SignalSemanticType = (typeof SIGNAL_SEMANTIC_TYPES)[number];

export const RATE_TIMEBASES = ['s', 'min', 'h', 'd'] as const;
export const INTERPOLATIONS = ['step', 'linear'] as const;
export const RESET_POLICIES = ['none', 'known_instant', 'detect_drop'] as const;

/** Where the signal lives at the source (PI: point/attribute WebId and path; MQTT: topic). */
export interface SignalSourceBinding {
  webId?: string;
  path?: string | null;
  topic?: string;
  /** lineage of a signal seeded from `historian_tags` (plan 1.7 step 1) */
  historianTagId?: string;
}

/** Quality policy (PI quality flags → engine): uncertain samples are used only when accepted. */
export interface SignalQualityPolicy {
  acceptUncertain?: boolean;
}

/**
 * Typed measurement signal (spec §14.2 `signals`, PI07, PI09): binds a source stream (`source_key` =
 * PI WebId or topic, unique per connection while effective) to a unit and declares how its samples
 * become quantities — semantic type, canonical unit, rate timebase, boundary interpolation, max gap,
 * reset behaviour, rollover modulus, expected range, cadence and quality policy. A configuration change
 * is a new version (the old row gets `effective_to`); samples keep pointing at the version that stored them.
 */
@Entity('signals')
@Index('IDX_signals_tenant_connection_source', [
  'tenantId',
  'connectionId',
  'sourceKey',
  'effectiveFrom',
])
@Index('IDX_signals_tenant_unit', ['tenantId', 'unitId'])
@Index('UQ_signals_current_source', ['tenantId', 'connectionId', 'sourceKey'], {
  unique: true,
  where: '"effective_to" IS NULL',
})
@Check(
  'CHK_signals_effective_interval',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check('CHK_signals_max_gap_positive', '"max_gap_seconds" > 0')
export class Signal extends TenantScopedEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connection_id' })
  connection?: IntegrationConnection;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'source_key', type: 'text' })
  sourceKey: string;

  @Column({ name: 'source_binding', type: 'jsonb', default: () => "'{}'" })
  sourceBinding: SignalSourceBinding;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({
    name: 'semantic_type',
    type: 'enum',
    enum: SIGNAL_SEMANTIC_TYPES,
    enumName: 'signal_semantic_type',
  })
  semanticType: SignalSemanticType;

  @Column({
    name: 'canonical_uom',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  canonicalUom: string | null;

  @Column({
    name: 'rate_timebase',
    type: 'enum',
    enum: RATE_TIMEBASES,
    enumName: 'signal_rate_timebase',
    nullable: true,
  })
  rateTimebase: (typeof RATE_TIMEBASES)[number] | null;

  @Column({
    name: 'interpolation',
    type: 'enum',
    enum: INTERPOLATIONS,
    enumName: 'signal_interpolation',
    default: 'step',
  })
  interpolation: (typeof INTERPOLATIONS)[number];

  @Column({ name: 'max_gap_seconds', type: 'int', default: 900 })
  maxGapSeconds: number;

  @Column({
    name: 'reset_policy',
    type: 'enum',
    enum: RESET_POLICIES,
    enumName: 'signal_reset_policy',
    default: 'none',
  })
  resetPolicy: (typeof RESET_POLICIES)[number];

  @Column({
    name: 'rollover_modulus',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  rolloverModulus: string | null;

  @Column({
    name: 'expected_min',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  expectedMin: string | null;

  @Column({
    name: 'expected_max',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  expectedMax: string | null;

  @Column({ name: 'cadence_seconds', type: 'int', nullable: true })
  cadenceSeconds: number | null;

  @Column({ name: 'quality_policy', type: 'jsonb', default: () => "'{}'" })
  qualityPolicy: SignalQualityPolicy;

  /** D05: the authoritative source of actuals for its unit/product (enforced in 1.10/2.4) */
  @Column({ name: 'is_authority', type: 'boolean', default: false })
  isAuthority: boolean;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;
}
