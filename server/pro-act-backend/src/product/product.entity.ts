import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index, VersionColumn } from 'typeorm';

@Entity('products')
@Unique('UQ_products_tenant_code', ['tenantId', 'code'])
@Index('IDX_products_organization', ['organizationId'])
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

  /** Optimistic concurrency version (If-Match on v2 master-data changes) */
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 