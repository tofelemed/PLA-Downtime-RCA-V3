/**
 * Views of the v2 administration API (backend `src/v2/administration/**`): users, the user directory,
 * scope grants, tasks, the audit trail, custom attribute definitions, organizations,
 * plants and branding. Hand-written like the other `types/` until the backend documents response schemas.
 */

export type LegacyRole = 'SuperAdmin' | 'OrgAdmin' | 'TenantAdmin' | 'Manager' | 'Analyst' | 'Engineer' | 'Operator';
export type ScopeRole =
  | 'manager_approver'
  | 'production_accountant'
  | 'quality_approver'
  | 'metrology_approver'
  | 'finance_approver'
  | 'finance_maintainer'
  | 'production_engineer'
  | 'reliability_engineer'
  | 'integration_admin'
  | 'master_data_admin'
  | 'operator'
  | 'viewer';

/** `GET /v2/users` item. */
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
  updatedAt: string;
  /** the caller may edit, deactivate or delete this user (never a user whose home plant is another plant) */
  manageable: boolean;
  /** the caller may grant or revoke this user's roles in the acting plant */
  accessManageable: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: LegacyRole;
  tenantId?: string;
  organizationId?: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: LegacyRole;
  isActive?: boolean;
  password?: string;
}

/** `GET /v2/users/directory` item. */
export interface UserDirectoryEntry {
  id: string;
  name: string;
  isActive: boolean;
}

export interface GrantableRolesView {
  roles: LegacyRole[];
  scopeRoles: ScopeRole[];
}

export type ScopeLock = 'home_role' | 'own_grant' | 'outranks_you' | 'other_plant' | null;

/** `GET /v2/user-scopes` item. */
export interface UserScopeView {
  id: string;
  userId: string;
  userName: string | null;
  scopeKind: 'tenant' | 'site' | 'unit';
  scopeId: string;
  scopeName: string | null;
  role: string;
  createdAt: string;
  createdByName: string | null;
  lock: ScopeLock;
}

/** A grant for a user of the plant (`userId`), or a first grant by exact e-mail within the organization. */
export type GrantScopeInput = { role: ScopeRole; unitId?: string } & ({ userId: string } | { email: string });

export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskLinkType = 'RCA' | 'RCARecommendation' | 'ProductionEvent' | 'ProductionPlan';

export const TASK_STATUSES: readonly TaskStatus[] = ['Open', 'In Progress', 'Completed', 'Cancelled'];
export const TASK_PRIORITIES: readonly TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const TASK_LINK_TYPES: readonly TaskLinkType[] = ['RCA', 'RCARecommendation', 'ProductionEvent', 'ProductionPlan'];

/** `GET /v2/tasks` item. */
export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assigneeName: string | null;
  assignedById: string;
  assignedByName: string | null;
  priority: TaskPriority | string;
  status: TaskStatus | string;
  dueDate: string | null;
  completedAt: string | null;
  overdue: boolean;
  linkType: TaskLinkType | string | null;
  linkId: string | null;
  /** item 5: the RCA action this task carries out (linkType RCA, linkId = the action's case) */
  rcaActionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSummaryView {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  asOf: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId: string;
  priority: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  linkType?: TaskLinkType;
  linkId?: string;
  /** item 5: the RCA action this task carries out (needs linkType RCA with the action's case; 409 ACTION_TASK_EXISTS) */
  rcaActionId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  linkType?: TaskLinkType | null;
  linkId?: string | null;
}

/** `GET /v2/audit-logs` item. */
export interface AuditEntryView {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  message: string | null;
  details: string | null;
}

export interface AuditCount {
  key: string;
  count: number;
}

export interface AuditSummaryView {
  total: number;
  byAction: AuditCount[];
  byEntityType: AuditCount[];
  byDay: Array<{ day: string; count: number }>;
  asOf: string;
}

export type AttributeEntityType = 'Organization' | 'Tenant' | 'Unit' | 'Asset';
export type AttributeDataType = 'string' | 'number' | 'boolean' | 'date' | 'select';
export const ATTRIBUTE_ENTITY_TYPES: readonly AttributeEntityType[] = ['Organization', 'Tenant', 'Unit', 'Asset'];
export const ATTRIBUTE_DATA_TYPES: readonly AttributeDataType[] = ['string', 'number', 'boolean', 'date', 'select'];

export interface AttributeValidation {
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  pattern: string | null;
}

/** `GET /v2/custom-attribute-definitions` item. */
export interface AttributeDefinitionView {
  id: string;
  entityType: AttributeEntityType | string;
  name: string;
  displayName: string;
  description: string | null;
  dataType: AttributeDataType | string;
  isRequired: boolean;
  defaultValue: string | null;
  validationRules: AttributeValidation;
  selectOptions: string[];
  displayOrder: number;
  isActive: boolean;
  scope: 'plant' | 'organization' | 'global';
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeDefinitionInput {
  entityType?: AttributeEntityType;
  name?: string;
  displayName?: string;
  description?: string;
  dataType?: AttributeDataType;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: Partial<Record<keyof AttributeValidation, number | string>>;
  selectOptions?: string[];
  displayOrder?: number;
  isActive?: boolean;
}

/** `GET /v2/organizations` item. */
export interface OrganizationView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  canAddPlants: boolean;
  canDelete: boolean;
}

/** `GET /v2/tenants` item: a plant. */
export interface PlantView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  organizationId: string;
  organizationName: string | null;
  timezone: string | null;
  calendarSystem: string;
  digits: string;
  /** first day of the reporting week: monday (ISO) or saturday (Iranian plants) */
  weekStart: string;
  isActive: boolean;
  canDelete: boolean;
}

export interface CreateOrganizationInput {
  code: string;
  name: string;
  description?: string;
}

export interface CreatePlantInput extends CreateOrganizationInput {
  organizationId: string;
  timezone: string;
}

/** `GET /v2/branding`. */
export interface BrandingView {
  appName: string;
  appSubtitle?: string;
  logoUrl?: string;
  logoInitials?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  logoSize?: number;
  logoObjectFit?: string;
  logoBorderRadius?: number;
  logoContainerSize?: number;
  logoContainerRadius?: number;
  logoContainerPadding?: number;
  logoBackgroundOpacity?: number;
  isStored: boolean;
  updatedAt: string | null;
}

export type BrandingInput = Omit<BrandingView, 'isStored' | 'updatedAt'>;
