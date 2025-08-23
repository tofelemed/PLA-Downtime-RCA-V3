import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  assignedTo: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignedTo' })
  assignedToUser: User;

  @Column({ type: 'uuid' })
  assignedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignedBy' })
  assignedByUser: User;

  @Column({ type: 'varchar', length: 50 })
  priority: string; // Low, Medium, High, Critical

  @Column({ type: 'varchar', length: 50 })
  status: string; // Open, In Progress, Completed, Cancelled

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ type: 'datetime', nullable: true })
  completedDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 