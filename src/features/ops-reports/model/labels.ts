/** Loss event types in words (server `physical_type` tokens). */
export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  downtime: 'Stop',
  slowdown: 'Slowdown',
  quality_loss: 'Quality loss',
  grade_transition: 'Grade transition',
};

/** Coding states in words (server `coding_state` tokens). */
export const CODING_STATE_LABELS: Readonly<Record<string, string>> = {
  uncoded: 'Not coded',
  coded: 'Coded',
  reviewed: 'Reviewed',
};
