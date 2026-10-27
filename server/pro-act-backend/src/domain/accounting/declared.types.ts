/** OEE component a reason code charges in declared mode; null = the reason names no component. */
export type ReasonComponent = 'availability' | 'performance' | 'quality';

/** Declared mode: reason code id → its default OEE component (null = none, line kind `unaccounted_classified`). */
export type ReasonComponents = Readonly<Record<string, ReasonComponent | null>>;

/**
 * The `loss_accounting` policy fields the engine applies (absent = the computed engine, the behaviour of
 * every run before declared mode existed).
 */
export interface DeclaredEnginePolicy {
  /** `declared`: the plan ledger is the OT system's declared shortfall split by reason */
  lossBasis?: 'computed' | 'declared';
  /** declared mode: the target is the OT planned figure (`declared`) or the slice's plan target */
  targetSource?: 'plan' | 'declared';
  /** declared mode: price the recorded full stops at the planning rate as an information figure */
  stopsCrossCheck?: boolean;
  /** declared mode: |planned − actual − shortfall| above this flags `declared_identity_mismatch` */
  identityTolerance?: number;
}
