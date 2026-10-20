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

/**
 * Item 8 open question 2: the basis after a PATCH that sets a reason code. The reason code's basis
 * (`next`) replaces the stored one, but `declarative_rule` entries of `previous` survive for the axes the
 * request and the reason code leave untouched (their values stay, so their provenance stays too).
 * `replaced` lists the axes whose value this request writes (stated by the user or filled by the code).
 */
export function keptRuleBasis(
  previous: ClassificationBasis | null | undefined,
  next: ClassificationBasis | null | undefined,
  replaced: ReadonlySet<CodeDrivenAxis>,
): ClassificationBasis | null {
  const merged: ClassificationBasis = { ...(next ?? {}) };
  for (const axis of CODE_DRIVEN_AXES) {
    const entry = previous?.[axis];
    if (entry?.source !== 'declarative_rule' || replaced.has(axis)) continue;
    merged[axis] = entry;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/** The stored axes of an event before a source revision changed its event type. */
export interface StoredAxes {
  scheduleClass: string;
  oeeComponent: string;
  impactCodeId?: string | null;
  classificationBasis?: ClassificationBasis | null;
  userOverrides?: Record<string, number> | null;
}

/** Axis values and the rebuilt basis after an event-type change (item 8 open question 1). */
export interface RetypedAxes {
  scheduleClass: string;
  oeeComponent: string;
  impactCodeId: string | null;
  classificationBasis: ClassificationBasis | null;
}

/** Bases a person or the reason code stated: an event-type change never moves them. */
const STATED_BASIS: ReadonlySet<string> = new Set([
  'user',
  'code_rule',
  'code_default',
]);

function isStatedAxis(stored: StoredAxes, axis: CodeDrivenAxis): boolean {
  if (stored.userOverrides?.[axis] !== undefined) return true;
  const source = stored.classificationBasis?.[axis]?.source;
  if (source !== undefined && STATED_BASIS.has(source)) return true;
  // an impact code the source or a person gave without a basis entry is stated too
  return axis === 'impactCodeId' && source === undefined
    ? Boolean(stored.impactCodeId)
    : false;
}

/**
 * Item 8 open question 1: a source revision changed the event type, so the write model re-derived the
 * schedule class and OEE component (`retyped`). Axes a user override or the reason code states keep
 * their stored value and basis. Every other axis (rule-filled before, or the event-type default) is open:
 * the active `coding_default` rules fill it again with their `declarative_rule` basis, and an axis no rule
 * fills takes the event-type default (no impact code) with no basis entry.
 */
export function retypedAxes(
  rules: readonly ActiveCodingRule[],
  stored: StoredAxes,
  retyped: RuleEventSource,
): RetypedAxes {
  const open = new Set(
    CODE_DRIVEN_AXES.filter((axis) => !isStatedAxis(stored, axis)),
  );
  const base = {
    scheduleClass: open.has('scheduleClass')
      ? retyped.scheduleClass
      : stored.scheduleClass,
    oeeComponent: open.has('oeeComponent')
      ? retyped.oeeComponent
      : stored.oeeComponent,
    impactCodeId: open.has('impactCodeId')
      ? null
      : (stored.impactCodeId ?? null),
  };
  const fill = fillOpenAxes(rules, { ...retyped, ...base }, open);
  const basis: ClassificationBasis = { ...(stored.classificationBasis ?? {}) };
  for (const axis of open) delete basis[axis];
  return {
    ...base,
    ...fill.values,
    classificationBasis: withRuleBasis(basis, fill),
  };
}
