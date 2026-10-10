/**
 * Provenance of the code-driven classification of an event (spec §3.2 "mapped by versioned rules with
 * visible overrides", plan 1.3). Stored in `production_events.classification_basis` and served by v2.
 */
export const CODE_DRIVEN_AXES = [
  'scheduleClass',
  'oeeComponent',
  'impactCodeId',
] as const;
export type CodeDrivenAxis = (typeof CODE_DRIVEN_AXES)[number];

export type AxisBasis = {
  /**
   * `code_rule`: a `code_mapping_rules` version; `code_default`: the reason code's default column;
   * `declarative_rule`: an active `coding_default` rule version (plan 3.8; `ruleId` is the rule)
   */
  source: 'code_rule' | 'code_default' | 'declarative_rule' | 'user';
  ruleId: string | null;
  ruleVersion: number | null;
  /** the value the rule or default proposes */
  defaultValue: string | null;
  /** true when the user chose a value different from `defaultValue` (the visible override flag) */
  overridesDefault: boolean;
};

export type ClassificationBasis = Partial<Record<CodeDrivenAxis, AxisBasis>>;

/** A proposed value for one axis from a rule or a code default. */
export interface AxisDefault {
  value: string;
  source: 'code_rule' | 'code_default';
  ruleId: string | null;
  ruleVersion: number | null;
}

export type CodeDefaults = Partial<Record<CodeDrivenAxis, AxisDefault>>;

/**
 * Values to apply and their basis: an explicit value wins (flagged when it differs from the default);
 * otherwise the default is applied. Axes without a default are left to the caller.
 */
export function applyCodeDefaults(
  defaults: CodeDefaults,
  explicit: Partial<Record<CodeDrivenAxis, string | null | undefined>>,
): {
  values: Partial<Record<CodeDrivenAxis, string>>;
  basis: ClassificationBasis;
} {
  const values: Partial<Record<CodeDrivenAxis, string>> = {};
  const basis: ClassificationBasis = {};
  for (const axis of CODE_DRIVEN_AXES) {
    const proposal = defaults[axis];
    if (!proposal) continue;
    const chosen = explicit[axis];
    if (chosen !== undefined && chosen !== null) {
      basis[axis] = {
        source: 'user',
        ruleId: proposal.ruleId,
        ruleVersion: proposal.ruleVersion,
        defaultValue: proposal.value,
        overridesDefault: chosen !== proposal.value,
      };
      continue;
    }
    values[axis] = proposal.value;
    basis[axis] = {
      source: proposal.source,
      ruleId: proposal.ruleId,
      ruleVersion: proposal.ruleVersion,
      defaultValue: proposal.value,
      overridesDefault: false,
    };
  }
  return { values, basis };
}
