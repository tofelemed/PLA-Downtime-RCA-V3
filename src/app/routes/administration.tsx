import { AdministrationRedirect } from '@/features/admin/shared/administration-redirect';
import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import { UserManagementRedirect } from '@/features/users/user-management-redirect';
import type { AppRoute } from './route-types';

/** Master data on v2: overview, units, assets, products, plant hierarchy and RCA settings as sub-pages. */
const MasterData = lazyNamedWithPreload(() => import('@/features/master-data/overview/master-data-overview-page'), 'MasterDataOverviewPage');
const Units = lazyNamedWithPreload(() => import('@/features/master-data/units/units-page'), 'UnitsPage');
const UnitDetail = lazyNamedWithPreload(() => import('@/features/master-data/units/unit-detail-page'), 'UnitDetailPage');
const Assets = lazyNamedWithPreload(() => import('@/features/master-data/assets/assets-page'), 'AssetsPage');
const AssetDetail = lazyNamedWithPreload(() => import('@/features/master-data/assets/asset-detail-page'), 'AssetDetailPage');
const Products = lazyNamedWithPreload(() => import('@/features/master-data/products/products-page'), 'ProductsPage');
const ProductDetail = lazyNamedWithPreload(() => import('@/features/master-data/products/product-detail-page'), 'ProductDetailPage');
const Hierarchy = lazyNamedWithPreload(() => import('@/features/master-data/hierarchy/hierarchy-page'), 'HierarchyPage');
const RcaTemplates = lazyNamedWithPreload(() => import('@/features/master-data/rca/templates-page'), 'RcaTemplatesPage');
const RcaTemplateDetail = lazyNamedWithPreload(() => import('@/features/master-data/rca/template-detail-page'), 'RcaTemplateDetailPage');
const RcaCauses = lazyNamedWithPreload(() => import('@/features/master-data/rca/causes-page'), 'RcaCausesPage');
const Checklists = lazyNamedWithPreload(() => import('@/features/master-data/rca/checklists-page'), 'ChecklistsPage');
const ChecklistDetail = lazyNamedWithPreload(() => import('@/features/master-data/rca/checklist-detail-page'), 'ChecklistDetailPage');
const FailureDictionary = lazyNamedWithPreload(() => import('@/features/master-data/reliability/failure-dictionary-page'), 'FailureDictionaryPage');
/** Reliability plant data (SME D1 / D2 / D6 / D9 / D10; transition allowance 2.5.6). */
const PlantFlow = lazyNamedWithPreload(() => import('@/features/master-data/plant-flow/plant-flow-page'), 'PlantFlowPage');
const StopPolicy = lazyNamedWithPreload(() => import('@/features/master-data/reliability/policy/stop-policy-page'), 'StopPolicyPage');
const StandbyEquipment = lazyNamedWithPreload(() => import('@/features/master-data/reliability/standby/standby-page'), 'StandbyEquipmentPage');
const UnitImpactRules = lazyNamedWithPreload(() => import('@/features/master-data/reliability/impact-rules/unit-impact-rules-page'), 'UnitImpactRulesPage');
const WorkOrders = lazyNamedWithPreload(() => import('@/features/master-data/reliability/work-orders/work-orders-page'), 'WorkOrdersPage');
const UnitState = lazyNamedWithPreload(() => import('@/features/master-data/reliability/unit-state/unit-state-page'), 'UnitStatePage');
/** Codes and declarative admin rules (plan 3.8): libraries, code pages, rule pages. */
const CodesAdmin = lazyNamedWithPreload(() => import('@/features/codes-admin/codes-admin-page'), 'CodesAdminPage');
const CodeDetail = lazyNamedWithPreload(() => import('@/features/codes-admin/codes/code-detail-page'), 'CodeDetailPage');
const RuleDetail = lazyNamedWithPreload(() => import('@/features/codes-admin/rules/rule-page'), 'RulePage');
const RuleNew = lazyNamedWithPreload(() => import('@/features/codes-admin/rules/rule-new-page'), 'RuleNewPage');
/** Valuation policy and exchange rates (plan 2.6 screens): list tabs and version pages. */
const Finance = lazyNamedWithPreload(() => import('@/features/finance/finance-page'), 'FinancePage');
const PolicyDetail = lazyNamedWithPreload(() => import('@/features/finance/policies/policy-detail-page'), 'PolicyDetailPage');
const PolicyNew = lazyNamedWithPreload(() => import('@/features/finance/policies/policy-new-page'), 'PolicyNewPage');
const FxRateDetail = lazyNamedWithPreload(() => import('@/features/finance/fx/fx-rate-detail-page'), 'FxRateDetailPage');
/** Administration on v2: users and their access, permissions, admin panel sections, tasks, audit log. */
const Users = lazyNamedWithPreload(() => import('@/features/users/user-management-page'), 'UserManagementPage');
const UserForm = lazyNamedWithPreload(() => import('@/features/users/user-form-page'), 'UserFormPage');
/** SME R1 / R6: delegations of approval roles (a tab of User management, or their own page). */
const DelegationsRoute = lazyNamedWithPreload(() => import('@/features/users/delegations-route'), 'DelegationsRoute');
const AdminPanel = lazyNamedWithPreload(() => import('@/features/admin/admin-page'), 'AdminPage');
const OrganizationNew = lazyNamedWithPreload(() => import('@/features/admin/plants/hierarchy-form-page'), 'OrganizationNewPage');
const PlantNew = lazyNamedWithPreload(() => import('@/features/admin/plants/hierarchy-form-page'), 'PlantNewPage');
const OrganizationEdit = lazyNamedWithPreload(() => import('@/features/admin/plants/hierarchy-form-page'), 'OrganizationEditPage');
const PlantEdit = lazyNamedWithPreload(() => import('@/features/admin/plants/hierarchy-form-page'), 'PlantEditPage');
const AttributeForm = lazyNamedWithPreload(() => import('@/features/admin/attributes/attribute-form-page'), 'AttributeFormPage');
const Tasks = lazyNamedWithPreload(() => import('@/features/tasks/tasks-page'), 'TasksPage');
const TaskForm = lazyNamedWithPreload(() => import('@/features/tasks/task-form-page'), 'TaskFormPage');
const AuditLog = lazyNamedWithPreload(() => import('@/features/audit/audit-page'), 'AuditPage');
const AuditEntry = lazyNamedWithPreload(() => import('@/features/audit/audit-entry-page'), 'AuditEntryPage');
/** Cross-page equipment setup guide, listed separately under Administration. */
const EquipmentSetup = lazyNamedWithPreload(() => import('@/features/equipment-setup/equipment-setup-page'), 'EquipmentSetupPage');

/** Administration area: master data, codes, finance, users, permissions, audit, settings (T5, T7, T8). */
const ROUTES: readonly AppRoute[] = [
  { path: '/master-data', element: <MasterData />, preload: MasterData.preload },
  { path: '/equipment-setup', element: <EquipmentSetup />, preload: EquipmentSetup.preload },
  { path: '/master-data/setup', element: <AdministrationRedirect kind="setup" /> },
  { path: '/master-data/units', element: <Units />, preload: Units.preload },
  { path: '/master-data/units/new', element: <UnitDetail />, preload: UnitDetail.preload },
  { path: '/master-data/units/:unitId', element: <UnitDetail />, preload: UnitDetail.preload },
  { path: '/master-data/assets', element: <Assets />, preload: Assets.preload },
  { path: '/master-data/assets/new', element: <AssetDetail />, preload: AssetDetail.preload },
  { path: '/master-data/assets/:assetId', element: <AssetDetail />, preload: AssetDetail.preload },
  { path: '/master-data/products', element: <Products />, preload: Products.preload },
  { path: '/master-data/products/new', element: <ProductDetail />, preload: ProductDetail.preload },
  { path: '/master-data/products/:productId', element: <ProductDetail />, preload: ProductDetail.preload },
  { path: '/master-data/hierarchy', element: <Hierarchy />, preload: Hierarchy.preload },
  { path: '/master-data/rca/templates', element: <RcaTemplates />, preload: RcaTemplates.preload },
  { path: '/master-data/rca/templates/new', element: <RcaTemplateDetail />, preload: RcaTemplateDetail.preload },
  { path: '/master-data/rca/templates/:templateId', element: <RcaTemplateDetail />, preload: RcaTemplateDetail.preload },
  { path: '/master-data/rca/causes', element: <RcaCauses />, preload: RcaCauses.preload },
  { path: '/master-data/rca/checklists', element: <Checklists />, preload: Checklists.preload },
  { path: '/master-data/rca/checklists/new', element: <ChecklistDetail />, preload: ChecklistDetail.preload },
  { path: '/master-data/rca/checklists/:checklistId', element: <ChecklistDetail />, preload: ChecklistDetail.preload },
  { path: '/master-data/failure-dictionary', element: <FailureDictionary />, preload: FailureDictionary.preload },
  { path: '/master-data/plant-flow', element: <PlantFlow />, preload: PlantFlow.preload },
  { path: '/master-data/stop-policy', element: <StopPolicy />, preload: StopPolicy.preload },
  { path: '/master-data/standby-equipment', element: <StandbyEquipment />, preload: StandbyEquipment.preload },
  { path: '/master-data/unit-impact-rules', element: <UnitImpactRules />, preload: UnitImpactRules.preload },
  { path: '/master-data/work-orders', element: <WorkOrders />, preload: WorkOrders.preload },
  { path: '/master-data/unit-state', element: <UnitState />, preload: UnitState.preload },
  { path: '/master-data/codes-rules', element: <CodesAdmin />, preload: CodesAdmin.preload },
  { path: '/master-data/codes-rules/rules/new', element: <RuleNew />, preload: RuleNew.preload },
  { path: '/master-data/codes-rules/rules/:ruleId', element: <RuleDetail />, preload: RuleDetail.preload },
  { path: '/master-data/codes-rules/:library/:codeId', element: <CodeDetail />, preload: CodeDetail.preload },
  { path: '/finance', element: <Finance />, preload: Finance.preload },
  { path: '/finance/policies/new', element: <PolicyNew />, preload: PolicyNew.preload, requires: 'canMaintainValuation', gateTitle: 'New valuation policy version' },
  { path: '/finance/policies/:policyId', element: <PolicyDetail />, preload: PolicyDetail.preload },
  { path: '/finance/fx/:fxId', element: <FxRateDetail />, preload: FxRateDetail.preload },
  // the page itself refuses or sends a delegation-only user to /delegations (QA re-test 2026-10-19)
  { path: '/users', element: <Users />, preload: Users.preload, requires: 'canViewOperations' },
  { path: '/users/new', element: <UserForm />, preload: UserForm.preload },
  { path: '/users/:userId', element: <UserForm />, preload: UserForm.preload },
  { path: '/permissions', element: <UserManagementRedirect tab="permissions" /> },
  { path: '/delegations', element: <DelegationsRoute />, preload: DelegationsRoute.preload, requires: 'canDelegateApprovals' },
  { path: '/admin', element: <AdminPanel />, preload: AdminPanel.preload },
  { path: '/admin/organizations/new', element: <OrganizationNew />, preload: OrganizationNew.preload },
  { path: '/admin/plants/new', element: <PlantNew />, preload: PlantNew.preload },
  { path: '/admin/organizations/:organizationId/edit', element: <OrganizationEdit />, preload: OrganizationEdit.preload },
  { path: '/admin/plants/:plantId/edit', element: <PlantEdit />, preload: PlantEdit.preload },
  { path: '/admin/attributes/new', element: <AttributeForm />, preload: AttributeForm.preload },
  { path: '/admin/attributes/:attributeId', element: <AttributeForm />, preload: AttributeForm.preload },
  { path: '/tasks', element: <Tasks />, preload: Tasks.preload },
  { path: '/tasks/new', element: <TaskForm />, preload: TaskForm.preload },
  { path: '/tasks/:taskId', element: <TaskForm />, preload: TaskForm.preload },
  { path: '/audit', element: <AuditLog />, preload: AuditLog.preload },
  { path: '/audit/:entryId', element: <AuditEntry />, preload: AuditEntry.preload },
  { path: '/settings', element: <AdministrationRedirect kind="settings" /> },
  { path: '/codes-admin/*', element: <AdministrationRedirect kind="codes" /> },
];

/**
 * The pages keep the gate they had under the one "Master data" menu entry (`canReachMasterData`; each page
 * checks its own writers): since 21 Oct 2026 they are listed under several Setup entries with narrower menu
 * capabilities, which must not narrow who may open them by link.
 */
export const ADMINISTRATION_ROUTES: readonly AppRoute[] = ROUTES.map((route) =>
  route.path.startsWith('/master-data') && !route.requires ? { ...route, requires: 'canReachMasterData' as const } : route,
);
