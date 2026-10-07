import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

@Entity('evidence_categories')
export class EvidenceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_name', type: 'varchar', length: 255 })
  name: string;

@Column({ type: 'text', nullable: true })
description?: string;

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