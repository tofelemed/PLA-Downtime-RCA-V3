import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { RcaAction } from '../rca/entities/rca-action.entity';

@Index('IDX_tasks_tenant_created', ['tenantId', 'createdAt'])
@Index('IDX_tasks_tenant_due', ['tenantId', 'dueDate', 'id'])
@Index('IDX_tasks_tenant_assignee', ['tenantId', 'assignedTo'])
@Index('IDX_tasks_tenant_rca_action', ['tenantId', 'rcaActionId'])
// one open task per RCA action (partial unique index, migration RcaRecommendationActionTasks)
@Index('UQ_tasks_open_rca_action', { synchronize: false })
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'assigned_to', type: 'varchar', length: 36 })
  assignedTo: string;

  @Column({ name: 'assigned_by', type: 'varchar', length: 36 })
  assignedBy: string;

  @Column({ name: 'priority', type: 'varchar', length: 50 })
  priority: string;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status: string;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column({ name: 'completed_date', type: 'timestamptz', nullable: true })
  completedDate?: Date;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType?: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36, nullable: true })
  entityId?: string;

  /** item 5: the RCA action this task carries out (with `entity_type` RCA = the action's case) */
  @Column({ name: 'rca_action_id', type: 'uuid', nullable: true })
  rcaActionId?: string | null;

  @ManyToOne(() => RcaAction, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'rca_action_id',
    foreignKeyConstraintName: 'FK_tasks_rca_action',
  })
  rcaAction?: RcaAction;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
