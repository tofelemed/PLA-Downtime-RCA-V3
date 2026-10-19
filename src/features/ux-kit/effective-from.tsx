import { BUILT_IN_DEFAULT_START, isBuiltInDefaultStart } from './format/built-in-default';
import { PlantTime } from './plant-time';

export interface EffectiveFromProps {
  /** UTC instant from the API */
  iso: string | null | undefined;
  /** plant IANA timezone */
  tz: string;
  /** word before a real time ("since", "From"); dropped for the built-in default */
  prefix?: string;
}

/**
 * The start of a version on the plant clock ("since 2026-10-17 05:30 (+03:30 Asia/Tehran)"), or
 * "Built-in default (from the start)" for a seeded default at the epoch sentinel (QA M1).
 */
export function EffectiveFrom({ iso, tz, prefix }: EffectiveFromProps) {
  if (isBuiltInDefaultStart(iso)) return <span data-testid="built-in-default-start">{BUILT_IN_DEFAULT_START}</span>;
  return (
    <>
      {prefix ? `${prefix} ` : ''}
      <PlantTime iso={iso} tz={tz} withDate />
    </>
  );
}
