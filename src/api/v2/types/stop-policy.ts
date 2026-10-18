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
}
export interface DerivedStopPreview {
  mapped: boolean; unitId: string; from: string; to: string; settings: StopEngineSettings;
  stops: Array<{ key: string; state: string; scheduleClass: string; startTime: string; endTime: string | null; description: string }>;
  slowdowns: Array<{ key: string; startTime: string; endTime: string | null; fraction: string | null; meanValue: number | null; description: string }>;
}
