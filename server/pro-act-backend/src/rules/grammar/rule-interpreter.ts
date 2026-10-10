import { RULE_LIMITS } from './rule-catalog';
import {
  isCondition,
  RuleAction,
  RuleCondition,
  RuleDefinition,
  RuleFacts,
  RuleGroup,
  RuleInnerGroup,
  RuleMember,
  RuleScalar,
} from './rule-definition';
import { globMatches, RuleBudgetExceeded, StepBudget } from './glob';

export interface RuleEvaluation {
  matched: boolean;
  /** actions of a matched rule (empty otherwise) */
  actions: RuleAction[];
  steps: number;
  /** the step budget ran out: the rule is treated as not matched */
  budgetExceeded: boolean;
}

type Fact = string | number | null | undefined;

const present = (fact: Fact): fact is string | number =>
  fact !== null && fact !== undefined && fact !== '';

function equals(fact: Fact, value: RuleScalar): boolean {
  if (!present(fact)) return false;
  if (typeof fact === 'number' && typeof value === 'number')
    return fact === value;
  return String(fact) === String(value);
}

function compare(
  fact: Fact,
  value: RuleScalar | RuleScalar[] | undefined,
): number | null {
  if (
    typeof fact !== 'number' ||
    typeof value !== 'number' ||
    !Number.isFinite(fact)
  )
    return null;
  return fact - value;
}

function listOf(value: RuleCondition['value']): RuleScalar[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function evaluateCondition(
  condition: RuleCondition,
  facts: RuleFacts,
  budget: StepBudget,
): boolean {
  budget.spend();
  const fact = facts[condition.field];
  const value = condition.value;
  switch (condition.op) {
    case 'exists':
      return present(fact);
    case 'eq':
      return (
        !Array.isArray(value) && value !== undefined && equals(fact, value)
      );
    case 'neq':
      return (
        !Array.isArray(value) &&
        value !== undefined &&
        present(fact) &&
        !equals(fact, value)
      );
    case 'in':
      return listOf(value).some((entry) => {
        budget.spend();
        return equals(fact, entry);
      });
    case 'matches':
      return (
        typeof value === 'string' &&
        present(fact) &&
        globMatches(value, String(fact), budget)
      );
    default:
      return compareOp(
        condition.op,
        compare(fact, Array.isArray(value) ? undefined : value),
      );
  }
}

function compareOp(
  op: RuleCondition['op'],
  difference: number | null,
): boolean {
  if (difference === null) return false;
  if (op === 'gt') return difference > 0;
  if (op === 'gte') return difference >= 0;
  if (op === 'lt') return difference < 0;
  return op === 'lte' && difference <= 0;
}

function evaluateGroup(
  group: RuleGroup | RuleInnerGroup,
  facts: RuleFacts,
  budget: StepBudget,
): boolean {
  const test = (member: RuleMember): boolean =>
    isCondition(member)
      ? evaluateCondition(member, facts, budget)
      : evaluateGroup(member, facts, budget);
  const allHold = (group.all ?? []).every(test);
  if (!allHold) return false;
  return group.any === undefined || group.any.some(test);
}

/**
 * Pure interpreter of a validated rule definition (plan 3.8, NFR02): reads only the given facts, has no
 * side effects, and stops when the step budget is spent (the rule then does not match). The same
 * definition and facts always give the same result (T22 replay).
 */
export function evaluateRule(
  definition: RuleDefinition,
  facts: RuleFacts,
  stepBudget: number = RULE_LIMITS.stepBudget,
): RuleEvaluation {
  const budget = new StepBudget(stepBudget);
  try {
    const matched = evaluateGroup(definition.when, facts, budget);
    return {
      matched,
      actions: matched ? definition.then : [],
      steps: budget.steps,
      budgetExceeded: false,
    };
  } catch (error) {
    if (!(error instanceof RuleBudgetExceeded)) throw error;
    return {
      matched: false,
      actions: [],
      steps: budget.steps,
      budgetExceeded: true,
    };
  }
}
