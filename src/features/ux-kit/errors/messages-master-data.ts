import type { ErrorMessage } from './error-message';

/** Master data: units, assets, products and RCA settings. */
export const MASTER_DATA_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  MASTER_DATA_CODE_EXISTS: { title: 'This code is already used', text: 'Each code must be unique. Choose another code.' },
  MASTER_DATA_RETIRED: { title: 'This record is retired', text: 'Restore it before changing it.' },
  MASTER_DATA_NOT_RETIRED: { title: 'This record is already active' },
  UNIT_HAS_ACTIVE_ASSETS: { title: 'This unit still has active assets', text: 'Retire its assets or move them to another unit first.' },
  RCA_CAUSE_HAS_CHILDREN: { title: 'This cause has sub-causes', text: 'Retire or move its sub-causes first.' },
  STANDBY_ALREADY_REGISTERED: { title: 'This asset is already on standby duty', text: 'Retire the open registration before registering it again.' },
  STANDBY_IMPORT_INVALID: { title: 'Some log rows are not valid', text: 'Nothing was stored. Fix the rows listed below and import again.' },
  INVALID_EFFECTIVE_FROM: { title: 'The effective-from must be in the past', text: 'A commissioning backdate starts before now. Leave it empty to take effect as usual.' },
  BACKDATE_REASON_REQUIRED: { title: 'Give the reason for backdating', text: 'A version that takes effect in the past needs a reason; it is kept with the version.' },
  BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM: { title: 'Choose the effective-from', text: 'A reason for backdating is only given with a past effective-from.' },
  BACKDATE_REWRITES_HISTORY: { title: 'Approved history cannot be rewritten', text: 'Choose an effective-from after the latest approved version of this scope took effect.' },
  BACKDATE_OVERLAPS_CALCULATION: { title: 'Figures were already calculated in this range', text: 'Choose an effective-from after the periods listed, or leave it empty to take effect as usual.' },
  WORK_ORDER_IMPORT_INVALID: { title: 'Some operation rows are not valid', text: 'Nothing was stored. Fix the rows listed below and import again.' },
};
