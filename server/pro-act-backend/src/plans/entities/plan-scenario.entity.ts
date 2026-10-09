import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * A planning scenario of a tenant (spec §14.2, PLAN04): approved plan versions never overlap per unit and
 * product **within** a scenario; several scenarios may exist, and exactly one is the accounting baseline
 * the plan ledger reconciles against (partial unique index). Each tenant gets a default baseline
 * scenario, created by the 2.3 migration or on first use.
 */
@Entity('plan_scenarios')
@Unique('UQ_plan_scenarios_tenant_name', ['tenantId', 'name'])
@Index('UQ_plan_scenarios_tenant_baseline', ['tenantId'], {
  unique: true,
  where: '"is_accounting_baseline"',
})
export class PlanScenario extends TenantScopedEntity {
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_accounting_baseline', type: 'boolean', default: false })
  isAccountingBaseline: boolean;
}
