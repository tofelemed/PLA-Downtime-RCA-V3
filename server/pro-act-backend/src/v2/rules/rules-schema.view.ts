import {
  GRAMMAR_VERSION,
  RULE_FIELDS,
  RULE_KIND_SPECS,
  RULE_KINDS,
  RULE_LIMITS,
  RULE_OPERATORS,
  RuleFieldSpec,
  RuleKindSpec,
  RuleOperator,
} from '../../rules/grammar/rule-catalog';

export interface RuleOperatorView {
  op: RuleOperator;
  label: string;
  /** what the value input takes: one value, a list, a glob pattern, or nothing */
  value: 'single' | 'list' | 'glob' | 'none';
}

/** `GET /api/v2/rules/schema`: the allowlist the builder's pickers are made from (plan 3.8). */
export interface RulesSchemaV2View {
  grammarVersion: number;
  schemaId: string;
  limits: typeof RULE_LIMITS;
  operators: RuleOperatorView[];
  fields: RuleFieldSpec[];
  kinds: RuleKindSpec[];
}

const OPERATOR_VIEWS: Readonly<
  Record<RuleOperator, Omit<RuleOperatorView, 'op'>>
> = {
  eq: { label: 'equals', value: 'single' },
  neq: { label: 'does not equal', value: 'single' },
  in: { label: 'is one of', value: 'list' },
  gt: { label: 'greater than', value: 'single' },
  gte: { label: 'at least', value: 'single' },
  lt: { label: 'less than', value: 'single' },
  lte: { label: 'at most', value: 'single' },
  exists: { label: 'is set', value: 'none' },
  matches: { label: 'matches pattern (* ?)', value: 'glob' },
};

export function rulesSchemaView(): RulesSchemaV2View {
  return {
    grammarVersion: GRAMMAR_VERSION,
    schemaId:
      'https://proact.local/contracts/rules/rule-definition.schema.json',
    limits: RULE_LIMITS,
    operators: RULE_OPERATORS.map((op) => ({ op, ...OPERATOR_VIEWS[op] })),
    fields: RULE_FIELDS.map((field) => ({ ...field })),
    kinds: RULE_KINDS.map((kind) => RULE_KIND_SPECS[kind]),
  };
}
