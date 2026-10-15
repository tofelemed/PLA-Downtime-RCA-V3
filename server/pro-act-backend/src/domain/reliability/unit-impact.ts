/**
 * Plan 1.10 step 4 / SME Q5 + D9: how an equipment-level stop affects its unit. ISO 14224 classifies each
 * failure's effect on production as total / partial / none; the SME answer keeps the equipment condition
 * apart from the production impact — a standby that takes over holds output (failure, no loss), a lost
 * train reduces throughput (partial), otherwise the unit stops (full downtime).
 */

/** Production impact a rule assigns (the stored `impact_mode` values a person may also state). */
export const UNIT_IMPACT_MODES = ['full_stop', 'fractional', 'none'] as const;
export type UnitImpactMode = (typeof UNIT_IMPACT_MODES)[number];

/**
 * Where an event's impact comes from: `stated` — a person (or a source frame) set it, the manual override
 * the resolver never touches; `default` — nobody did (downtime stops the unit); `unit_rule` — the unit
 * impact rule in force at the stop's start; `standby_takeover` — the rule's standby took over.
 */
export const IMPACT_BASES = [
  'default',
  'stated',
  'unit_rule',
  'standby_takeover',
] as const;
export type ImpactBasis = (typeof IMPACT_BASES)[number];

/** An approved unit impact rule version of one asset of a unit, in force at the stop's start. */
export interface ImpactRule {
  id: string;
  version: number;
  mode: UnitImpactMode;
  /** share of the unit's rate lost (0 < f ≤ 1, decimal string) when `mode = fractional` */
  fraction: string | null;
  /** installed spare whose successful start holds the unit's output (SME D9); null = none */
  standbyAssetId: string | null;
  /** a standby run starting at most this long after the stop's start is a takeover */
  takeoverSeconds: number;
}

/** A logged run of the standby asset (SME D9 `standby_records`, kind `run`). */
export interface StandbyRun {
  id: string;
  start: Date;
  /** null = still running */
  end: Date | null;
  outcome: string;
}

/** The stop as the resolver sees it (a live downtime event with an asset). */
export interface ImpactSubject {
  start: Date;
  end: Date | null;
  impactMode: string;
  impactFraction: string | null;
  impactBasis: ImpactBasis;
}

export interface ResolvedImpact {
  /** a rule mode, or the stored mode of a stated impact (which may also be `measured`) */
  mode: string;
  fraction: string | null;
  basis: ImpactBasis;
  ruleId: string | null;
  ruleVersion: number | null;
  standbyRecordId: string | null;
}

/**
 * Whether the impact is a person's (or source's) statement the rules never replace: `stated`, or — for
 * events written before the basis was recorded — anything but the downtime default `full_stop`.
 */
export function isManualImpact(subject: ImpactSubject): boolean {
  if (subject.impactBasis === 'stated') return true;
  return (
    subject.impactBasis === 'default' && subject.impactMode !== 'full_stop'
  );
}

/**
 * A successful standby run that starts within the takeover window and lasts at least to the stop's end
 * (still running counts). A late or failed start leaves the rule's own impact for the whole stop.
 */
export function takeoverRun(
  subject: ImpactSubject,
  rule: ImpactRule,
  runs: readonly StandbyRun[],
): StandbyRun | null {
  if (!rule.standbyAssetId) return null;
  const from = subject.start.getTime();
  const latest = from + rule.takeoverSeconds * 1000;
  return (
    [...runs]
      .sort(
        (a, b) =>
          a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id),
      )
      .find((run) => {
        const start = run.start.getTime();
        if (run.outcome !== 'success' || start < from || start > latest)
          return false;
        if (run.end === null) return true;
        return subject.end !== null && run.end >= subject.end;
      }) ?? null
  );
}

/**
 * The unit impact of an equipment stop (plan 1.10 `ImpactResolver`): null = keep the stored impact (a
 * manual override); no rule in force = the downtime default `full_stop`; the rule's standby took over =
 * `none` (failure, no production loss); else the rule's mode and fraction. Pure and deterministic.
 */
export function resolveUnitImpact(
  subject: ImpactSubject,
  rule: ImpactRule | null,
  runs: readonly StandbyRun[],
): ResolvedImpact | null {
  if (isManualImpact(subject)) return null;
  if (!rule) {
    return {
      mode: 'full_stop',
      fraction: null,
      basis: 'default',
      ruleId: null,
      ruleVersion: null,
      standbyRecordId: null,
    };
  }
  const run = takeoverRun(subject, rule, runs);
  const ref = { ruleId: rule.id, ruleVersion: rule.version };
  if (run) {
    return {
      mode: 'none',
      fraction: null,
      basis: 'standby_takeover',
      ...ref,
      standbyRecordId: run.id,
    };
  }
  return {
    mode: rule.mode,
    fraction: rule.mode === 'fractional' ? rule.fraction : null,
    basis: 'unit_rule',
    ...ref,
    standbyRecordId: null,
  };
}

/** The resolution changes what the event stores (mode, fraction or basis). */
export function impactChanged(
  subject: ImpactSubject,
  resolved: ResolvedImpact,
): boolean {
  const fraction = (value: string | null) =>
    value === null ? null : Number(value);
  return (
    subject.impactMode !== resolved.mode ||
    fraction(subject.impactFraction) !== fraction(resolved.fraction) ||
    subject.impactBasis !== resolved.basis
  );
}
