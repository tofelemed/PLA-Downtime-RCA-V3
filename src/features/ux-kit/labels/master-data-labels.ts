/** Labels of the master-data screens (units, assets, products, RCA settings). */
export const RECORD_STATUS_FILTER_LABELS: Readonly<Record<'active' | 'retired' | 'all', string>> = {
  active: 'Active',
  retired: 'Retired',
  all: 'Active and retired',
};

export const PRODUCT_AVAILABILITY_LABELS: Readonly<Record<'organization' | 'plant', string>> = {
  organization: 'All plants of the organisation',
  plant: 'This plant only',
};

export const CAUSE_CATEGORY_LABELS: Readonly<
  Record<'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method', string>
> = {
  Equipment: 'Equipment',
  Process: 'Process',
  Material: 'Material',
  Personnel: 'Personnel',
  Environment: 'Environment',
  Method: 'Method',
};

export const ASSET_CRITICALITY_LABELS: Readonly<Record<'High' | 'Medium' | 'Low', string>> = {
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};

/** Asset types offered by the form (free text is stored; these are the v1 choices). */
export const ASSET_TYPE_OPTIONS = ['Equipment', 'Instrument', 'Tool', 'Vehicle', 'Building', 'Other'] as const;

/** Operating statuses offered by the asset form (v1 choices; stored as text). */
export const ASSET_STATUS_OPTIONS = ['Active', 'Inactive', 'Maintenance', 'Offline'] as const;

/** Sort choices of the master-data lists. */
export const MASTER_DATA_SORT_LABELS: Readonly<Record<'code' | 'name' | '-createdAt', string>> = {
  code: 'Code (A–Z)',
  name: 'Name (A–Z)',
  '-createdAt': 'Newest first',
};
