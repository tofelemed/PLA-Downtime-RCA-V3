import type { RcaStatus } from '@/api/v2/types/rca';

/** The workflow stages in order (F-4); `Published` (a v1 status) reads as the analysis stage. */
export const CASE_STAGES: readonly RcaStatus[] = ['Draft', 'In Progress', 'Analysis', 'Monitoring', 'Closure Review', 'Closed'];

const ALIASES: Readonly<Record<string, RcaStatus>> = { Published: 'Analysis' };

/** Position of a case status on the stepper; no status is Draft, an unknown one is -1 (nothing current). */
export function stageIndexOf(status: string | null): number {
  const stage = status ? ALIASES[status] ?? status : 'Draft';
  return CASE_STAGES.findIndex((value) => value === stage);
}

export type StageState = 'done' | 'current' | 'upcoming';

/** Done before the current stage, the current one, or still to come. */
export function stageStateOf(index: number, current: number): StageState {
  if (index < current) return 'done';
  return index === current ? 'current' : 'upcoming';
}
