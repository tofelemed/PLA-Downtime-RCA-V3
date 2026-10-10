import type { CodeView } from './flags';

/** Libraries of the code management screen (plan 3.8) and their v2 paths. */
export type CodeLibraryPath =
  | 'reason-codes'
  | 'impact-codes'
  | 'oee-codes'
  | 'failure-code-groups'
  | 'loss-category-defs';

export type FailureGroupKind = 'class' | 'problem' | 'cause' | 'remedy';

/** `CodeV2View` with the library-specific fields (backend `src/code-library/code-view.ts`). */
export interface CodeDetailView extends CodeView {
  category?: string | null;
  groupKind?: FailureGroupKind;
  reportOrder?: number;
  defaults?: {
    oeeComponent: string | null;
    scheduleClass: string | null;
    impactCodeId: string | null;
  };
  costPerHour?: string | null;
}

/** `GET /{library}/{id}/versions` (oldest first); `snapshot` flattens nested fields as `defaults.x`. */
export interface CodeVersionView {
  version: number;
  code: string;
  name: string;
  parentId: string | null;
  snapshot: Record<string, string | number | boolean | null>;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
}

/** `GET /{library}/{id}/references` and `details.references` of 409 CODE_HAS_CHILDREN. */
export interface CodeReferencesView {
  activeChildren: number;
  events: number;
  mappingRules: number;
}

export interface AxisDefaultView {
  value: string;
  source: 'code_rule' | 'code_default';
  ruleId: string | null;
  ruleVersion: number | null;
}

/** `GET /reason-codes/{id}/mapping-preview` (backend `code-mapping-preview.service.ts`). */
export interface CodeMappingPreviewView {
  codeId: string;
  from: string;
  to: string;
  proposed: Partial<Record<'scheduleClass' | 'oeeComponent' | 'impactCodeId', AxisDefaultView>>;
  events: number;
  current: { scheduleClass: Record<string, number>; oeeComponent: Record<string, number> };
  wouldDiffer: { scheduleClass: number; oeeComponent: number };
}

export type CodeMappingRuleKind = 'reason_to_oee' | 'reason_to_schedule_class' | 'reason_to_impact' | 'impact_to_valuation';

/** `CodeMappingRuleView` (backend `code-mapping-rule.service.ts`); versions are append-only. */
export interface CodeMappingRuleView {
  id: string;
  ruleKind: CodeMappingRuleKind;
  sourceCodeId: string;
  targetValue: string | null;
  targetCodeId: string | null;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}
