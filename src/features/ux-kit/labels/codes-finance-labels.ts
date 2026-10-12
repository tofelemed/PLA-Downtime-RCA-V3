/**
 * Labels of the codes & rules and finance screens (T5): classification defaults of reason codes, mapping
 * rule sources, valuation policy status and authorship. Shared enum maps live in `admin-labels.ts` and
 * `planning-labels.ts`; this file only adds what those do not cover.
 */
export const OEE_COMPONENT_LABELS: Readonly<Record<string, string>> = {
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  idle: 'Idle (not counted)',
  none: 'Not an OEE loss',
};

export const SCHEDULE_CLASS_LABELS: Readonly<Record<string, string>> = {
  planned: 'Planned',
  unplanned: 'Unplanned',
  external: 'External',
  unknown: 'Unknown',
};

/** Where a default classification of a reason code comes from (`GET /reason-codes/{id}/mapping-preview`). */
export const MAPPING_SOURCE_LABELS: Readonly<Record<'code_rule' | 'code_default', string>> = {
  code_rule: 'default mapping',
  code_default: 'set on the code',
};

/** Valuation policy version status (`finance/model/policy-status.ts`). */
export const POLICY_STATUS_LABELS: Readonly<Record<'approved' | 'unapproved' | 'placeholder', string>> = {
  approved: 'Approved',
  unapproved: 'Not approved',
  placeholder: 'Earlier setup (no currency)',
};

/** Who wrote a version, relative to the viewer. */
export const AUTHORSHIP_LABELS: Readonly<Record<'you' | 'someone-else' | 'system', string>> = {
  you: 'You',
  'someone-else': 'Another user',
  system: 'System',
};

/** Rule version origin (`GET /rules/{id}/versions`). */
export const RULE_VERSION_ORIGIN_LABELS: Readonly<Record<string, string>> = {
  activation: 'Activated',
  rollback: 'Rolled back',
};
