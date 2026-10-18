import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/** Per-tenant, versioned code library (plan 1.3): unique per tenant, history in `code_versions`. */
@Entity('impact_codes')
@Unique('UQ_impact_codes_tenant_code', ['tenantId', 'code'])
export class ImpactCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'category', type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({
    name: 'cost_per_unit',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  costPerUnit?: number;

  @Column({
    name: 'cost_per_hour',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  costPerHour?: number;

  @Column({ name: 'cost_basis', type: 'varchar', length: 20, nullable: true })
  costBasis?: string;

  @Column({ name: 'severity', type: 'varchar', length: 50, nullable: true })
  severity?: string;

  @Column({ name: 'color', type: 'varchar', length: 7, nullable: true })
  color?: string;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom?: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo?: Date | null;

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
