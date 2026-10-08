/** The distinct code libraries of spec §3.2 (NFR01: every one is per tenant, never global). */
export const CODE_LIBRARIES = [
  'reason',
  'impact',
  'oee',
  'failure',
  'loss_category',
] as const;
export type CodeLibraryKind = (typeof CODE_LIBRARIES)[number];

/** Failure taxonomy levels (Maximo class → problem → cause → remedy); a child is one level below its parent. */
export const FAILURE_GROUP_KINDS = [
  'class',
  'problem',
  'cause',
  'remedy',
] as const;
export type FailureGroupKind = (typeof FAILURE_GROUP_KINDS)[number];

export const CODE_MAPPING_RULE_KINDS = [
  'reason_to_oee',
  'reason_to_schedule_class',
  'reason_to_impact',
  'impact_to_valuation',
] as const;
export type CodeMappingRuleKind = (typeof CODE_MAPPING_RULE_KINDS)[number];
