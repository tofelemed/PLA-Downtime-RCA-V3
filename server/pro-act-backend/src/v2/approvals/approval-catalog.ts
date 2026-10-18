import { EntityTarget, ObjectLiteral } from 'typeorm';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../../profiles/entities/valuation-rate.entity';
import { GradeTransitionStandard } from '../../profiles/entities/transition-standard.entity';
import { UnitStream } from '../../plant-model/entities/unit-stream.entity';
import { PlantFlowRoute } from '../../plant-model/entities/plant-flow-route.entity';
import { UnitImpactRule } from '../../plant-model/entities/unit-impact-rule.entity';
import { FxRate } from '../../valuation/entities/fx-rate.entity';
import { DemandStatus } from '../../valuation/entities/demand-status.entity';
import { PROFILE_APPROVERS } from '../profiles/profile-roles';
import { FINANCE_APPROVERS } from '../valuation/valuation-roles';

export type ApprovalAction =
  | 'approve'
  | 'retire'
  | 'reject'
  | 'return'
  | 'activate';
export interface ApprovalDefinition {
  kind: string;
  label: string;
  entity: EntityTarget<ObjectLiteral>;
  pending: string;
  roles: readonly string[];
  unit?: string;
  secondUnit?: string;
  author?: string;
  state?: string;
  version?: string;
  title: string;
  summary: string;
  href: string;
  resource?: string;
  commandId?: string;
  actions?: ApprovalAction[];
  supersede?: boolean;
  joins?: Array<{
    entity: EntityTarget<ObjectLiteral>;
    alias: string;
    on: string;
  }>;
}
export const PROFILE_JOIN = {
  entity: ProductionProfile,
  alias: 'p',
  on: 'p.id = r.profileId AND p.tenantId = r.tenantId',
};
export const VERSION_APPROVALS: ApprovalDefinition[] = [
  {
    kind: 'profile',
    label: 'Production profile',
    entity: ProductionProfile,
    unit: 'r.unitId',
    title: "r.operatingMode || ' profile'",
    summary:
      "concat('Product ', r.productId, ' · ', r.quantityUom, ' / ', r.rateTimebase)",
    href: "'/planning/profiles/' || r.id",
    resource: 'profiles',
  },
  {
    kind: 'rate',
    label: 'Production rate',
    entity: UnitProductRate,
    unit: 'p.unitId',
    joins: [PROFILE_JOIN],
    title: "r.rateKind || ' rate'",
    summary: "concat(r.rate, ' / ', r.timebase)",
    href: "'/planning/profiles/' || r.profileId",
    resource: 'rates',
  },
  {
    kind: 'valuation-rate',
    label: 'Valuation rate',
    entity: ValuationRate,
    unit: 'p.unitId',
    joins: [PROFILE_JOIN],
    roles: FINANCE_APPROVERS,
    title: "r.basis || ' valuation rate'",
    summary: "concat(r.value, ' ', r.currency, ' / ', r.perUom)",
    href: "CASE WHEN r.profileId IS NOT NULL THEN '/planning/profiles/' || r.profileId ELSE '/planning?tab=profiles' END",
    resource: 'valuation-rates',
  },
  {
    kind: 'transition-standard',
    label: 'Transition standard',
    entity: GradeTransitionStandard,
    unit: 'r.unitId',
    title: "'Grade transition'",
    summary: "concat(r.referenceSeconds, ' seconds · ', r.operatingMode)",
    href: "'/planning?tab=transitions'",
    resource: 'transition-standards',
  },
  {
    kind: 'unit-stream',
    label: 'Unit stream',
    entity: UnitStream,
    unit: 'r.unitId',
    title: 'r.name',
    summary: "concat(r.code, ' · capacity share ', r.capacityShare)",
    href: "'/planning?tab=streams'",
    resource: 'unit-streams',
  },
  {
    kind: 'flow-route',
    label: 'Plant flow route',
    entity: PlantFlowRoute,
    unit: 'r.fromUnitId',
    secondUnit: 'r.toUnitId',
    title: "r.routeRole || ' route'",
    summary: "concat('To unit ', r.toUnitId, ' · yield ', r.yieldFactor)",
    href: "'/master-data/plant-flow'",
    resource: 'flow-routes',
  },
  {
    kind: 'unit-impact-rule',
    label: 'Unit impact rule',
    entity: UnitImpactRule,
    unit: 'r.unitId',
    title: "r.mode || ' impact rule'",
    summary: "concat('Asset ', r.assetId, ' · fraction ', r.fraction)",
    href: "'/master-data/unit-impact-rules'",
    resource: 'unit-impact-rules',
  },
  {
    kind: 'fx-rate',
    label: 'Exchange rate',
    entity: FxRate,
    roles: FINANCE_APPROVERS,
    title: "r.fromCurrency || ' → ' || r.toCurrency",
    summary: "concat(r.rate, ' · ', r.rateType)",
    href: "'/finance/fx/' || r.id",
    resource: 'fx-rates',
  },
  {
    kind: 'demand-status',
    label: 'Demand status',
    entity: DemandStatus,
    roles: FINANCE_APPROVERS,
    title: "r.status || ' demand'",
    summary: "concat('Product ', r.productId)",
    href: "'/finance?tab=demand'",
    resource: 'demand-statuses',
    supersede: true,
  },
].map((definition) => ({
  pending: "r.state = 'draft'",
  roles: PROFILE_APPROVERS,
  actions: ['approve', 'retire'],
  supersede: true,
  ...definition,
}));
