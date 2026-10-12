import type { CodeLibraryPath, CodeMappingRuleKind, FailureGroupKind } from '@/api/v2/types/codes-admin';
import type { RcaLinkType } from '@/api/v2/types/rca';
import type { RuleKind, RuleOperator, RuleState } from '@/api/v2/types/rules';

/** Labels of codes & rules administration and RCA links (plans 3.8, 3.9). */
export const CODE_LIBRARY_LABELS: Readonly<Record<CodeLibraryPath, string>> = {
  'reason-codes': 'Reason codes',
  'impact-codes': 'Impact codes',
  'oee-codes': 'OEE codes',
  'failure-code-groups': 'Failure code groups',
  'loss-category-defs': 'Loss categories',
};

export const FAILURE_GROUP_KIND_LABELS: Readonly<Record<FailureGroupKind, string>> = {
  class: 'Failure class',
  problem: 'Problem',
  cause: 'Cause',
  remedy: 'Remedy',
};

export const CODE_MAPPING_RULE_KIND_LABELS: Readonly<Record<CodeMappingRuleKind, string>> = {
  reason_to_oee: 'Reason → OEE component',
  reason_to_schedule_class: 'Reason → schedule class',
  reason_to_impact: 'Reason → impact',
  impact_to_valuation: 'Impact → valuation',
};

export const RULE_KIND_LABELS: Readonly<Record<RuleKind, string>> = {
  coding_default: 'Default coding',
  status_derivation: 'Status derivation',
  rca_trigger_hint: 'RCA recommendation',
  validation: 'Validation',
};

export const RULE_STATE_LABELS: Readonly<Record<RuleState, string>> = {
  draft: 'Draft',
  active: 'Active',
  retired: 'Retired',
};

export const RULE_OPERATOR_LABELS: Readonly<Record<RuleOperator, string>> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  exists: 'is set',
  matches: 'matches',
};

export const RCA_LINK_TYPE_LABELS: Readonly<Record<RcaLinkType, string>> = {
  event: 'Event',
  loss_line: 'Loss line',
  work_order: 'Work order',
  occurrence: 'Repeat occurrence',
};
