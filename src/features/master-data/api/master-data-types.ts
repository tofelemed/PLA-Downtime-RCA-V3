/**
 * v2 master-data views (backend `src/v2/units|assets|products|rca-settings|master-data`). Decimals are strings,
 * times ISO UTC; `rowVersion` is the If-Match revision of a change.
 */
export type RecordStatusFilter = 'active' | 'retired' | 'all';
export type MasterDataSort = 'code' | '-code' | 'name' | '-name' | 'createdAt' | '-createdAt';

export interface MasterDataListFilters {
  q?: string;
  status?: RecordStatusFilter;
  sort?: MasterDataSort;
}

interface Revisioned {
  id: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface MasterUnitView extends Revisioned {
  code: string;
  name: string;
  /** null = the plant's default site */
  siteId: string | null;
  /** name of the unit's site (the default site's when `siteId` is null); null while the plant has no site */
  siteName?: string | null;
  description: string | null;
  unitOfMeasure: string | null;
  capacity: string | null;
  idealCycleTimeSeconds: string | null;
  retiredAt: string | null;
}

export interface MasterAssetView extends Revisioned {
  code: string;
  name: string;
  unitId: string;
  description: string | null;
  assetType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  criticality: string | null;
  status: string | null;
  location: string | null;
  retiredAt: string | null;
}

export type ProductAvailability = 'organization' | 'plant';

export interface MasterProductView extends Revisioned {
  code: string;
  name: string;
  uom: string | null;
  isActive: boolean;
  description: string | null;
  availability: ProductAvailability;
  /** single reads only */
  legacyStandardCost?: string | null;
}

export type CauseCategory = 'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method';

export interface LogicTreeNode {
  id: string;
  name: string;
  code: string;
  category: CauseCategory;
  description?: string;
  note?: string;
  finding?: boolean;
  children?: LogicTreeNode[];
}

export interface RcaTemplateView extends Revisioned {
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  nodeCount: number;
  checklistIds: string[];
  logicTree?: LogicTreeNode[];
}

export interface RcaCauseView extends Revisioned {
  code: string;
  name: string;
  description: string | null;
  category: CauseCategory | null;
  parentId: string | null;
  isActive: boolean;
  activeChildren: number;
}

export interface VerificationChecklistView extends Revisioned {
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  items: string[];
  isActive: boolean;
}

export interface MasterDataSummaryView {
  units: number;
  assets: number;
  products: number;
  rcaTemplates: number;
  rcaCauses: number;
  verificationChecklists: number;
}
