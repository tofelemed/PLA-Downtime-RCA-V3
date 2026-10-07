import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dashboard_configurations')
export class DashboardConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dashboard_name', type: 'varchar', length: 255 })
  dashboardName: string;

  @Column({ name: 'dashboard_type', type: 'varchar', length: 100, nullable: true })
  dashboardType?: string;

  @Column({ name: 'layout_config', type: 'text', nullable: true })
  layoutConfig?: string;

  @Column({ name: 'widget_config', type: 'text', nullable: true })
  widgetConfig?: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}