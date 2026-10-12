import type { ErrorMessage } from './error-message';

/** Master data: units, assets, products and RCA settings. */
export const MASTER_DATA_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  MASTER_DATA_CODE_EXISTS: { title: 'This code is already used', text: 'Each code must be unique. Choose another code.' },
  MASTER_DATA_RETIRED: { title: 'This record is retired', text: 'Restore it before changing it.' },
  MASTER_DATA_NOT_RETIRED: { title: 'This record is already active' },
  UNIT_HAS_ACTIVE_ASSETS: { title: 'This unit still has active assets', text: 'Retire its assets or move them to another unit first.' },
  RCA_CAUSE_HAS_CHILDREN: { title: 'This cause has sub-causes', text: 'Retire or move its sub-causes first.' },
};
