import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReconcileForm } from '../reconcile-form/reconcile-form.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('loss_categories')
export class LossCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reconcileFormId: string;
  @ManyToOne(() => ReconcileForm)
  @JoinColumn({ name: 'reconcileFormId' })
  reconcileForm: ReconcileForm;

  @Column({ type: 'varchar', length: 255 })
  categoryName: string;

  @Column({ type: 'numeric', precision: 28, scale: 8 })
  lossAmount: number;

  @Column({ type: 'uuid' })
  impactCodeId: string;
  @ManyToOne(() => ImpactCode)
  @JoinColumn({ name: 'impactCodeId' })
  impactCode: ImpactCode;

  @Column({ type: 'uuid' })
  oeeCodeId: string;
  @ManyToOne(() => OEECode)
  @JoinColumn({ name: 'oeeCodeId' })
  oeeCode: OEECode;

  @Column({ type: 'text' })
  description: string;

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
