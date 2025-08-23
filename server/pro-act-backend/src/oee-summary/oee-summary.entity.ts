import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('oee_summaries')
export class OEESummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  planId: string;
  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'planId' })
  plan: ProductionPlan;

  @Column({ type: 'float' })
  availability: number;

  @Column({ type: 'float' })
  performance: number;

  @Column({ type: 'float' })
  quality: number;

  @Column({ type: 'float' })
  overallOEE: number;

  @Column({ type: 'varchar', length: 100 })
  period: string;

  @Column({ type: 'uuid' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 