import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from '../unit/unit.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('production_plan_templates')
export class ProductionPlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Note: Database schema has: name, description, template_data, is_active, tenant_id, organization_id
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'template_data',
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: any) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
      },
      from: (value: string | null) => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
    },
  })
  templateData?: any;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  // Note: Database schema doesn't have these columns - they should be in template_data JSON
  // @Column({ type: 'uuid' })
  // unitId: string;
  // @Column({ type: 'simple-array' })
  // productIds: string[];
  // @Column({ type: 'varchar', length: 100 })
  // planBasis: string;
  // @Column({ type: 'timestamptz' })
  // startDate: Date;
  // @Column({ type: 'timestamptz' })
  // endDate: Date;
  // @Column({ type: 'varchar', length: 100, nullable: true })
  // recurrence: string;
  // @Column({ type: 'text', nullable: true })
  // usefulProductionTime: string;
  // @Column({ type: 'varchar', length: 100, nullable: true })
  // dataEntryFrequency: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 