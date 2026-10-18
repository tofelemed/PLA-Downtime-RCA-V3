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
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const FLOW_ROUTE_ROLES = ['feed', 'alternate'] as const;
export type FlowRouteRole = (typeof FLOW_ROUTE_ROLES)[number];

const decimal = (name: string, precision = 24, scale = 8) => ({
  name,
  type: 'numeric' as const,
  precision,
  scale,
  nullable: true,
  transformer: decimalStringTransformer,
});

/**
 * A route of the plant's material-flow map (SME E2): `fromUnitId` feeds `toUnitId`, optionally through
 * a buffer (silo) with usable inventory, operating limits and the downstream draw rate (inventory unit
 * per hour) that turn it into hours of cover. Effective-dated, versioned per route like rates
 * (maker-checker, supersede, no overlapping approved version); approved routes never form a cycle.
 */
@Entity('plant_flow_routes')
@Index('IDX_approval_inbox_plant_flow_routes', { synchronize: false })
@Unique('UQ_plant_flow_routes_version', ['fromUnitId', 'toUnitId', 'version'])
@Exclusion(
  'EX_plant_flow_routes_approved_no_overlap',
  `USING gist ("from_unit_id" WITH =, "to_unit_id" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) ` +
    `WHERE ("state" = 'approved')`,
)
@Index('IDX_plant_flow_routes_tenant_to', ['tenantId', 'toUnitId'])
@Index('IDX_plant_flow_routes_tenant_from', ['tenantId', 'fromUnitId'])
@Check('CHK_plant_flow_routes_units', '"from_unit_id" <> "to_unit_id"')
@Check('CHK_plant_flow_routes_role', `"route_role" IN ('feed', 'alternate')`)
@Check('CHK_plant_flow_routes_yield', '"yield_factor" > 0')
@Check(
  'CHK_plant_flow_routes_buffer',
  `(("usable_inventory" IS NULL AND "max_operating_level" IS NULL) OR ("inventory_uom" IS NOT NULL AND "draw_rate_per_hour" IS NOT NULL)) ` +
    `AND ("usable_inventory" IS NULL OR "usable_inventory" >= 0) AND ("draw_rate_per_hour" IS NULL OR "draw_rate_per_hour" > 0)`,
)
@Check(
  'CHK_plant_flow_routes_limits',
  '"min_operating_level" IS NULL OR "max_operating_level" IS NULL OR "max_operating_level" > "min_operating_level"',
)
@Check(
  'CHK_plant_flow_routes_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_plant_flow_routes_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class PlantFlowRoute extends TenantScopedEntity {
  @Column({ name: 'from_unit_id', type: 'uuid' })
  fromUnitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'from_unit_id',
    foreignKeyConstraintName: 'FK_plant_flow_routes_from_unit',
  })
  fromUnit?: Unit;

  @Column({ name: 'to_unit_id', type: 'uuid' })
  toUnitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'to_unit_id',
    foreignKeyConstraintName: 'FK_plant_flow_routes_to_unit',
  })
  toUnit?: Unit;

  @Column({ name: 'route_role', type: 'varchar', length: 16, default: 'feed' })
  routeRole: FlowRouteRole;

  /** downstream output per unit of feed (recorded on the map; propagation uses the draw rate) */
  @Column({
    ...decimal('yield_factor', 12, 8),
    nullable: false,
    default: 1,
  })
  yieldFactor: string;

  @Column({ name: 'buffer_name', type: 'varchar', length: 255, nullable: true })
  bufferName: string | null;

  /** usable inventory when no recent level is recorded; null = derived from the limits, or no buffer */
  @Column(decimal('usable_inventory'))
  usableInventory: string | null;

  @Column(decimal('min_operating_level'))
  minOperatingLevel: string | null;

  @Column(decimal('max_operating_level'))
  maxOperatingLevel: string | null;

  @Column({
    name: 'inventory_uom',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  inventoryUom: string | null;

  /** downstream draw from the buffer at full rate, inventory unit per hour */
  @Column(decimal('draw_rate_per_hour'))
  drawRatePerHour: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

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
    enumName: 'plant_flow_route_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
