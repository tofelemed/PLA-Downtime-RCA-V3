import {
  ClassificationBasis,
  CODE_DRIVEN_AXES,
  CodeDrivenAxis,
} from '../code-library/classification-basis';
import {
  OeeComponent,
  ScheduleClass,
} from '../domain/events/event-classification';
import { isSetAction, RuleDefinition } from './grammar/rule-definition';
import { evaluateRule } from './grammar/rule-interpreter';
import { eventFacts, RuleEventSource } from './rule-event-facts';

/** The version in force of one active `coding_default` rule, in evaluation order. */
export interface ActiveCodingRule {
  id: string;
  version: number;
  definition: RuleDefinition;
}

/** A value an active `coding_default` rule proposes for one axis. */
export interface RuleProposal {
  axis: CodeDrivenAxis;
  value: string;
  ruleId: string;
  ruleVersion: number;
}

/** Values the rules filled and their `declarative_rule` basis entries. */
export interface RuleFill {
  values: Partial<Record<CodeDrivenAxis, string>>;
  basis: ClassificationBasis;
}

/** What a creator already has on each axis (stated by the user or source, or a reason-code default). */
export type StatedAxes = Partial<
  Record<CodeDrivenAxis, string | null | undefined>
>;

/**
 * Proposals of the rules for one event (plan 3.8): rules run in the given order (priority, then name)
 * with the pure interpreter; the first rule that sets an axis wins.
 */
export function ruleProposals(
  rules: readonly ActiveCodingRule[],
  event: RuleEventSource,
): RuleProposal[] {
  if (rules.length === 0) return [];
  const facts = eventFacts(event);
  const chosen = new Map<CodeDrivenAxis, RuleProposal>();
  for (const rule of rules) {
    for (const action of evaluateRule(rule.definition, facts).actions) {
      if (!isSetAction(action)) continue;
      const axis = CODE_DRIVEN_AXES.find((entry) => entry === action.set);
      if (!axis || chosen.has(axis)) continue;
      chosen.set(axis, {
        axis,
        value: action.value,
        ruleId: rule.id,
        ruleVersion: rule.version,
      });
    }
  }
  return [...chosen.values()];
}

/**
 * Rule proposals for the `open` axes only (precedence stated value > reason-code default > declarative
 * rule > event-type default); every filled axis records its rule and version as a default, never as a
 * user override.
 */
export function fillOpenAxes(
  rules: readonly ActiveCodingRule[],
  event: RuleEventSource,
  open: ReadonlySet<CodeDrivenAxis>,
): RuleFill {
  const values: Partial<Record<CodeDrivenAxis, string>> = {};
  const basis: ClassificationBasis = {};
  if (open.size === 0) return { values, basis };
  for (const proposal of ruleProposals(rules, event)) {
    if (!open.has(proposal.axis)) continue;
    values[proposal.axis] = proposal.value;
    basis[proposal.axis] = {
      source: 'declarative_rule',
      ruleId: proposal.ruleId,
      ruleVersion: proposal.ruleVersion,
      defaultValue: proposal.value,
      overridesDefault: false,
    };
  }
  return { values, basis };
}

/** The axes nobody has a value for yet (absent, null or empty). */
export function openAxesOf(stated: StatedAxes): Set<CodeDrivenAxis> {
  return new Set(
    CODE_DRIVEN_AXES.filter((axis) => {
      const value = stated[axis];
      return value === undefined || value === null || value === '';
    }),
  );
}

/** The filled schedule class and OEE component, as write-model classification. */
export function filledClassification(fill: RuleFill): {
  scheduleClass?: ScheduleClass;
  oeeComponent?: OeeComponent;
} {
  const { scheduleClass, oeeComponent } = fill.values;
  return {
    ...(scheduleClass ? { scheduleClass: scheduleClass as ScheduleClass } : {}),
    ...(oeeComponent ? { oeeComponent: oeeComponent as OeeComponent } : {}),
  };
}

/** `basis` extended by the rule-filled axes; null when neither has an entry. */
export function withRuleBasis(
  basis: ClassificationBasis | null | undefined,
  fill: RuleFill,
): ClassificationBasis | null {
  const merged: ClassificationBasis = { ...(basis ?? {}), ...fill.basis };
  return Object.keys(merged).length > 0 ? merged : null;
}
