/** SME E3: plain words for the product disposition classes (backend `domain/actuals/period/quality-classes.ts`). */
export const DISPOSITION_CLASS_LABELS: Readonly<Record<string, string>> = {
  wide_spec: 'Wide-spec grade (ordered, good)',
  downgrade: 'Downgrade / off-grade (sold at a discount)',
  transition_off_grade: 'Transition off-grade',
  scrap: 'Scrap',
  rework: 'Rework / recycle',
  recovered: 'Recovered from rework',
};

/** The classes a quality-loss event may name (the lot disposition carries the others). */
export const EVENT_DISPOSITION_CLASSES = ['downgrade', 'scrap', 'rework'] as const;

/** Classes an operator records on a lot (a recovery is recorded from the disposition it recovers). */
export const LOT_DISPOSITION_CLASSES = ['wide_spec', 'downgrade', 'transition_off_grade', 'scrap', 'rework'] as const;

/** Classes whose quantity can later be recovered (scrap is gone, wide-spec is good already). */
export const RECOVERABLE_CLASSES: readonly string[] = ['downgrade', 'transition_off_grade', 'rework'];

export const DISPOSITION_STATE_LABELS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Corrected (superseded)',
};
