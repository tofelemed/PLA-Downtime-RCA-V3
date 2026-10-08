import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  OEE_COMPONENTS,
  OeeComponent,
  SCHEDULE_CLASSES,
  ScheduleClass,
} from '../domain/events/event-classification';
import { ImpactCode } from '../impact-code/impact-code.entity';

/**
 * Reason code library (spec §3.2, §14.2): per tenant, hierarchical (`parent_id`, materialised `path` of
 * ids joined by '/', `level` 0 = root), versioned (`version` = current version, history in
 * `code_versions`), with an active interval and classification defaults (plan 1.3).
 */
@Entity('reason_codes')
@Unique('UQ_reason_codes_tenant_code', ['tenantId', 'code'])
@Index('IDX_reason_codes_tenant_parent', ['tenantId', 'parentId'])
@Index('IDX_reason_codes_tenant_path', ['tenantId', 'path'])
export class ReasonCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => ReasonCode, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent?: ReasonCode;

  /** ids from the root to this code joined by '/' (a root's path is its id) */
  @Column({ name: 'path', type: 'text', nullable: true })
  path?: string | null;

  @Column({ name: 'level', type: 'int', default: 0 })
  level: number;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom?: Date | null;

  /** set when the code is retired; half-open [effective_from, effective_to) */
  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo?: Date | null;

  @Column({
    name: 'default_oee_component',
    type: 'enum',
    enum: OEE_COMPONENTS,
    enumName: 'production_event_oee_component',
    nullable: true,
  })
  defaultOeeComponent?: OeeComponent | null;

  @Column({
    name: 'default_schedule_class',
    type: 'enum',
    enum: SCHEDULE_CLASSES,
    enumName: 'production_event_schedule_class',
    nullable: true,
  })
  defaultScheduleClass?: ScheduleClass | null;

  @Column({ name: 'default_impact_code_id', type: 'uuid', nullable: true })
  defaultImpactCodeId?: string | null;

  @ManyToOne(() => ImpactCode, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'default_impact_code_id' })
  defaultImpactCode?: ImpactCode;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
