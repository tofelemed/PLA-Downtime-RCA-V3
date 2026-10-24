import { nameRepeats } from '../model/name-repeats';
import { useEventHubEnv } from '../use-event-hub-env';

/**
 * C-10: a unit by its master-data name, with its code as secondary text when the code adds something
 * to the name ("unit100"), not when it repeats it ("Extruder1" after "HDPE Extruder 1"); the code is
 * always the tooltip. Never the raw id.
 */
export function UnitLabel({ unitId }: { unitId: string | null | undefined }) {
  const env = useEventHubEnv();
  const code = env.unitCode?.(unitId) ?? null;
  const name = env.unitName(unitId);
  return (
    <span title={code ? `Code ${code}` : undefined} data-testid="unit-label">
      {name}
      {code && !nameRepeats(name, code) && <span className="ml-1 text-xs text-muted-foreground">{code}</span>}
    </span>
  );
}
