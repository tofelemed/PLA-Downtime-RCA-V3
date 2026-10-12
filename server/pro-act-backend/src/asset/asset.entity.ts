import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';

@Entity('assets')
@Index('IDX_assets_tenant_unit', ['tenantId', 'unitId'])
@Index('IDX_assets_tenant_code', ['tenantId', 'code'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'asset_type', type: 'varchar', length: 50, nullable: true })
  assetType?: string;

  @Column({ name: 'manufacturer', type: 'varchar', length: 255, nullable: true })
  manufacturer?: string;

  @Column({ name: 'model', type: 'varchar', length: 255, nullable: true })
  model?: string;

  @Column({ name: 'serial_number', type: 'varchar', length: 255, nullable: true })
  serialNumber?: string;

  @Column({ name: 'criticality', type: 'varchar', length: 50, nullable: true })
  criticality?: string;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string;

  @Column({ name: 'location', type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ name: 'installation_date', type: 'timestamptz', nullable: true })
  installationDate?: Date;

  @Column({ name: 'last_maintenance_date', type: 'timestamptz', nullable: true })
  lastMaintenanceDate?: Date;

  @Column({ name: 'next_maintenance_date', type: 'timestamptz', nullable: true })
  nextMaintenanceDate?: Date;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  /** When the asset was retired (v2 master data); null = active. Retired assets keep their history. */
  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt?: Date | null;

  /** Optimistic concurrency version (If-Match on v2 master-data changes) */
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}