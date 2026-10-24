import { BUILT_IN_DEFAULT_START, isBuiltInDefaultStart } from '@/features/ux-kit/format/built-in-default';
import { PlantTime } from '@/features/ux-kit/plant-time';

export interface PlantInstantProps {
  iso: string | null | undefined;
  tz: string;
}

/** A date and time on the plant clock without the zone suffix: the app header already shows the plant timezone. */
export function PlantInstant({ iso, tz }: PlantInstantProps) {
  return <PlantTime iso={iso} tz={tz} withDate withZone={false} />;
}

/** The start of a version ("From 2026-10-17 05:30"), or "Built-in default (from the start)" for a seeded default. */
export function EffectiveFromText({ iso, tz, prefix }: PlantInstantProps & { prefix: string }) {
  if (isBuiltInDefaultStart(iso)) return <span data-testid="built-in-default-start">{BUILT_IN_DEFAULT_START}</span>;
  return (
    <>
      {`${prefix} `}
      <PlantInstant iso={iso} tz={tz} />
    </>
  );
}
