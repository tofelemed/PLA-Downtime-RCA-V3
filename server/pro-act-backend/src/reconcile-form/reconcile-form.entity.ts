import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionLoss } from '../production-loss/production-loss.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('reconcile_forms')
export class ReconcileForm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lossId: string;
  @ManyToOne(() => ProductionLoss)
  @JoinColumn({ name: 'lossId' })
  loss: ProductionLoss;

  @Column({ type: 'float' })
  totalLossAmount: number;

  @Column({ type: 'float' })
  categorizedLossAmount: number;

  @Column({ type: 'float' })
  unaccountedLossAmount: number;

  @Column({ type: 'varchar', length: 255 })
  productionEvent: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'varchar', length: 50 })
  status: string; // Draft, Submitted, Approved, Rejected

  @Column({ type: 'nvarchar', length: 'max' })
  categories: string;

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