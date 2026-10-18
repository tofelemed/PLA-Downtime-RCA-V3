export interface StopEngineSettings {
  deriveFromState: boolean;
  debounceSeconds: number;
  restartConfirmSeconds: number;
  duplicateToleranceSeconds: number;
  autoMergeDuplicates: boolean;
  incidentWindowSeconds: number;
}
export interface StopEnginePolicy extends StopEngineSettings {
  id: string; unitId: string | null; version: number; effectiveFrom: string; notes: string | null;
  /** commissioning backdate: the past instant requested and why (null = effective when recorded) */
  requestedEffectiveFrom: string | null; backdateReason: string | null;
}
/** `POST /stop-event-policies` (StopEventPolicyCreateDto): stated settings, scope, note and optional commissioning backdate. */
export type StopEnginePolicyBody = StopEngineSettings & { unitId?: string; notes?: string; effectiveFrom?: string; backdateReason?: string };
export interface DerivedStopPreview {
  mapped: boolean; unitId: string; from: string; to: string; settings: StopEngineSettings;
  stops: Array<{ key: string; state: string; scheduleClass: string; startTime: string; endTime: string | null; description: string }>;
  slowdowns: Array<{ key: string; startTime: string; endTime: string | null; fraction: string | null; meanValue: number | null; description: string }>;
}
