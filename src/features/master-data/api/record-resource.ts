import type { V2Resource } from '@/api/v2/queries/query-keys';

/**
 * One v2 master-data resource: where it lives, which cache resource holds it and which change notice
 * invalidates it. Every resource has the same commands: create (POST), change (PATCH + If-Match),
 * retire and restore (POST, Idempotency-Key).
 */
export interface RecordResource {
  /** cache resource (several RCA settings share `rca-settings`, told apart by `path`) */
  resource: V2Resource;
  /** path under the v2 base, e.g. `/units` */
  path: string;
  /** change-notice entity type (invalidation.ts) */
  entityType: string;
}

export const UNITS: RecordResource = { resource: 'units', path: '/units', entityType: 'unit' };
export const ASSETS: RecordResource = { resource: 'assets', path: '/assets', entityType: 'asset' };
export const PRODUCTS: RecordResource = { resource: 'products', path: '/products', entityType: 'product' };
export const RCA_TEMPLATES: RecordResource = { resource: 'rca-settings', path: '/rca-templates', entityType: 'rca_settings' };
export const RCA_CAUSES: RecordResource = { resource: 'rca-settings', path: '/rca-causes', entityType: 'rca_settings' };
export const VERIFICATION_CHECKLISTS: RecordResource = {
  resource: 'rca-settings',
  path: '/verification-checklists',
  entityType: 'rca_settings',
};
