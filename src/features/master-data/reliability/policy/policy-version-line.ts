import type { MetricFormat } from '../standby/standby-metrics-model';

export interface PolicyVersionFacts {
  version: number;
  /** null = the plant-wide version */
  unitId: string | null;
  effectiveFrom: string;
}

/**
 * "Version 3 · plant-wide (the unit has no override) · in force since …": which oee_policy version applies
 * to the chosen scope (`asked` = the unit chosen, '' = the plant).
 */
export function policyVersionLine(view: PolicyVersionFacts, asked: string, format: Pick<MetricFormat, 'number'> & { dateTime: (iso: string) => string }): string {
  const scope = view.unitId ? 'this unit' : asked ? 'plant-wide (the unit has no override)' : 'plant-wide';
  return `Version ${format.number(view.version)} · ${scope} · in force since ${format.dateTime(view.effectiveFrom)}`;
}
