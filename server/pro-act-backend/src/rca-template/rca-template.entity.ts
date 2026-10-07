import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('rca_templates')
export class RCATemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Note: Database schema has: template_name, template_type, template_data, description, is_active
  @Column({ name: 'template_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  // Map category to template_type for database
  @Column({ name: 'template_type', type: 'varchar', length: 100, nullable: true })
  category?: string;

  // Map logicTreeStructure to template_data JSON for database
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
  logicTreeStructure?: any;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Note: Database schema doesn't have 'verificationChecklist' column
  // @Column({ type: 'simple-array' })
  // verificationChecklist: string[];

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  // @ManyToOne(() => Organization)
  // @JoinColumn({ name: 'organizationId' })
  // organization: Organization;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  // @ManyToOne(() => Tenant)
  // @JoinColumn({ name: 'tenantId' })
  // tenant: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 