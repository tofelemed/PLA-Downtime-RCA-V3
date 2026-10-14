import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const OPERATION_KINDS = [
  'diagnosis',
  'repair',
  'test',
  'other',
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

/** Kinds that are active repair (SME D10: verified diagnosis, repair and required functional test). */
export const ACTIVE_REPAIR_KINDS: ReadonlySet<OperationKind> = new Set([
  'diagnosis',
  'repair',
  'test',
]);

/**
 * SME D10: one operation of a CMMS work order with its own start / end and the waiting inside it (parts,
 * permit, crew) — the evidence of active repair time. Work-order creation and administrative closure are
 * never used. Linked to the stop it repaired (`event_id`) when known; one row per work order + operation.
 */
@Entity('work_order_operations')
@Index(
  'UQ_work_order_operations_operation',
  ['tenantId', 'workOrderId', 'operationId'],
  { unique: true },
)
@Index('IDX_work_order_operations_tenant_event', ['tenantId', 'eventId'])
@Index('IDX_work_order_operations_tenant_asset_start', [
  'tenantId',
  'assetId',
  'startedAt',
])
@Check(
  'CHK_work_order_operations_interval',
  '"ended_at" IS NULL OR "ended_at" >= "started_at"',
)
@Check(
  'CHK_work_order_operations_kind',
  `"operation_kind" IN ('diagnosis', 'repair', 'test', 'other')`,
)
@Check('CHK_work_order_operations_waiting', '"waiting_seconds" >= 0')
export class WorkOrderOperation extends TenantScopedEntity {
  @Column({ name: 'work_order_id', type: 'varchar', length: 100 })
  workOrderId: string;

  @Column({ name: 'operation_id', type: 'varchar', length: 50 })
  operationId: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ name: 'operation_kind', type: 'varchar', length: 16 })
  operationKind: OperationKind;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  /** null = the operation is still running (its repair is censored) */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  /** waiting for parts, permit or crew inside [started_at, ended_at) (seconds; not active repair) */
  @Column({ name: 'waiting_seconds', type: 'int', default: 0 })
  waitingSeconds: number;

  @Column({
    name: 'waiting_reason',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  waitingReason: string | null;

  /** CMMS the row was mapped from (e.g. SAP PM, Maximo) */
  @Column({ name: 'source', type: 'varchar', length: 50, default: 'import' })
  source: string;
}
