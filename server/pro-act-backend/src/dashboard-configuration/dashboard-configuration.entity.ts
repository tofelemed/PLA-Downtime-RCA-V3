import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

@Entity('dashboard_configurations')
export class DashboardConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'nvarchar', length: 'max' })
  oee: string;

  @Column({ type: 'nvarchar', length: 'max' })
  losses: string;

  @Column({ type: 'nvarchar', length: 'max' })
  costs: string;

  @Column({ type: 'nvarchar', length: 'max' })
  bottleneckRisk: string;

  @Column({ type: 'nvarchar', length: 'max' })
  display: string;

  @Column({ type: 'nvarchar', length: 'max' })
  performance: string;

  @Column({ type: 'nvarchar', length: 'max' })
  quality: string;

  @Column({ type: 'nvarchar', length: 'max' })
  availability: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastModifiedBy: string;

  @Column({ type: 'datetime', nullable: true })
  lastModifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 