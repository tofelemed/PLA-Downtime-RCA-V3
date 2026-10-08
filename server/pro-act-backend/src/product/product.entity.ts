import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('products')
@Unique('UQ_products_tenant_code', ['tenantId', 'code'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  unitOfMeasure?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'standard_rate', type: 'decimal', precision: 15, scale: 4, nullable: true })
  standardCost?: number;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 