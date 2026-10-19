import type {
  AttributeDataType,
  AttributeEntityType,
  ScopeLock,
  TaskLinkType,
  TaskPriority,
  TaskStatus,
} from '@/api/v2/types/administration';
import { GLOSSARY } from './glossary';

/** Labels of the administration screens: tasks, audit trail, scope grants, custom attributes, plants. */
export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  Open: 'Open',
  'In Progress': 'In progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Critical: 'Critical',
};

export const TASK_LINK_LABELS: Readonly<Record<TaskLinkType, string>> = {
  RCA: GLOSSARY.investigation,
  RCARecommendation: 'RCA recommendation',
  ProductionEvent: 'Production event',
  ProductionPlan: 'Production plan',
};

/** Audit actions written by the server (auto audit, reads, sign-in) and by older client audit calls. */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  READ: 'Viewed',
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  ACCESS_DENIED: 'Access refused',
  CREATE_USER: 'User created',
  UPDATE_USER: 'User changed',
  DELETE_USER: 'User deleted',
  ACTIVATE_USER: 'User activated',
  DEACTIVATE_USER: 'User deactivated',
};

/** Audit entity types whose plain name differs from the humanized token. */
export const AUDIT_ENTITY_LABELS: Readonly<Record<string, string>> = {
  Tenant: 'Plant',
  USER: 'User session',
  Exports: 'Export',
  RCA: GLOSSARY.investigation,
  UserScope: 'Access grant',
  AppSettings: 'Application setting',
  CustomAttributeDefinition: 'Custom attribute',
  CustomAttributeValue: 'Custom attribute value',
  DashboardConfiguration: 'Dashboard settings',
};

export const SCOPE_LOCK_LABELS: Readonly<Record<Exclude<ScopeLock, null>, string>> = {
  home_role: 'Comes from the user’s role; change the role instead',
  own_grant: 'You cannot change your own access',
  outranks_you: 'Only a higher administrator can remove this',
  other_plant: 'This user belongs to another plant',
};

export const SCOPE_KIND_LABELS: Readonly<Record<'tenant' | 'site' | 'unit', string>> = {
  tenant: GLOSSARY.wholePlant,
  site: 'Site',
  unit: 'Unit',
};

export const ATTRIBUTE_ENTITY_LABELS: Readonly<Record<AttributeEntityType, string>> = {
  Organization: 'Organizations',
  Tenant: 'Plants',
  Unit: 'Units',
  Asset: 'Assets',
};

export const ATTRIBUTE_DATA_TYPE_LABELS: Readonly<Record<AttributeDataType, string>> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Yes / no',
  date: 'Date',
  select: 'Choice list',
};

export const ATTRIBUTE_SCOPE_LABELS: Readonly<Record<'plant' | 'organization' | 'global', string>> = {
  plant: 'This plant',
  organization: 'Organization',
  global: 'All plants',
};

export const CALENDAR_SYSTEM_LABELS: Readonly<Record<string, string>> = {
  gregorian: 'Gregorian',
  persian: 'Persian (Jalali)',
};
