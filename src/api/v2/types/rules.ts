/** Declarative admin rules (plan 3.8; backend `src/rules/`, contract `contracts/rules/`). */
export type RuleKind = 'coding_default' | 'status_derivation' | 'rca_trigger_hint' | 'validation';
export type RuleState = 'draft' | 'active' | 'retired';
export type RuleOperator = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'matches';
export type RuleScalar = string | number | boolean;

export interface RuleConditionDef {
  field: string;
  op: RuleOperator;
  value?: RuleScalar | RuleScalar[];
}

export interface RuleInnerGroupDef {
  all?: RuleConditionDef[];
  any?: RuleConditionDef[];
}

export interface RuleGroupDef {
  all?: Array<RuleConditionDef | RuleInnerGroupDef>;
  any?: Array<RuleConditionDef | RuleInnerGroupDef>;
}

export type RuleActionDef = { set: string; value: string } | { flag: string };

/** A type alias (not an interface) so it is assignable to the generated `{ [x: string]: unknown }` body. */
export type RuleDefinitionDef = {
  when: RuleGroupDef;
  then: RuleActionDef[];
};

export interface RuleView {
  id: string;
  kind: RuleKind;
  name: string;
  description: string | null;
  priority: number;
  state: RuleState;
  activeVersion: number | null;
  activeDefinition: RuleDefinitionDef | null;
  draft: { definition: RuleDefinitionDef; authorId: string | null; updatedAt: string | null } | null;
  appliedBy: string;
  rowVersion: number;
  createdAt: string;
  createdBy: string | null;
  retiredAt: string | null;
}

export interface RuleVersionView {
  version: number;
  definition: RuleDefinitionDef;
  origin: 'activation' | 'rollback';
  restoredVersion: number | null;
  authoredBy: string | null;
  approvedBy: string;
  effectiveFrom: string;
  reason: string | null;
  current: boolean;
}

export type RuleFieldType = 'enum' | 'number' | 'text' | 'reference';
export type RuleReference = 'reason_code' | 'impact_code' | 'unit' | 'asset';

export interface RuleFieldSpecView {
  name: string;
  label: string;
  type: RuleFieldType;
  values?: string[];
  references?: RuleReference;
  operators: RuleOperator[];
}

export interface RuleOperatorView {
  op: RuleOperator;
  label: string;
  value: 'single' | 'list' | 'glob' | 'none';
}

export interface RuleSetTargetView {
  field: string;
  label: string;
  values?: string[];
  references?: 'impact_code';
}

export interface RuleKindSpecView {
  kind: RuleKind;
  label: string;
  sets: RuleSetTargetView[];
  flags: boolean;
  appliedBy: string;
}

/** `GET /rules/schema`: the allowlist the builder's pickers come from. */
export interface RulesSchemaView {
  grammarVersion: number;
  schemaId: string;
  limits: { maxConditions: number; maxDepth: number; maxActions: number; maxListValues: number; maxGlobLength: number; stepBudget: number };
  operators: RuleOperatorView[];
  fields: RuleFieldSpecView[];
  kinds: RuleKindSpecView[];
}

/** `POST /rules/validate`: the same checks create/update apply, nothing stored. */
export interface RuleCheckView {
  valid: boolean;
  fieldErrors: Array<{ field: string; message: string }>;
  conditionCount: number | null;
}

export interface RuleSimulationView {
  runId: string;
  ruleId: string;
  version: number | null;
  scope: { from: string; to: string; unitIds: string[] | null };
  ranAt: string;
  evaluated: number;
  matched: number;
  changed: number;
  truncated: boolean;
  budgetExceeded: number;
  maxSteps: number;
  fields: Record<string, { before: Record<string, number>; after: Record<string, number> }>;
  flags: Record<string, number>;
  samples: Array<{
    eventId: string;
    unitId: string;
    startTime: string;
    changes: Array<{ field: string; before: string | null; after: string }>;
    flags: string[];
  }>;
}
