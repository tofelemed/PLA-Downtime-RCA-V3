import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('impact_codes')
export class ImpactCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'category', type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({ name: 'cost_per_unit', type: 'decimal', precision: 15, scale: 4, nullable: true })
  costPerUnit?: number;

  @Column({ name: 'cost_per_hour', type: 'decimal', precision: 15, scale: 4, nullable: true })
  costPerHour?: number;

  @Column({ name: 'cost_basis', type: 'varchar', length: 20, nullable: true })
  costBasis?: string;

  @Column({ name: 'severity', type: 'varchar', length: 50, nullable: true })
  severity?: string;

  @Column({ name: 'color', type: 'varchar', length: 7, nullable: true })
  color?: string;

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