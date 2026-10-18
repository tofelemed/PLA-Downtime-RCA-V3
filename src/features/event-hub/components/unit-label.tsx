import { useEventHubEnv } from '../use-event-hub-env';

/**
 * C-10: a unit by its master-data name, with its code as secondary text (and tooltip) when the code
 * differs from the name; never the raw id.
 */
export function UnitLabel({ unitId }: { unitId: string | null | undefined }) {
  const env = useEventHubEnv();
  const code = env.unitCode?.(unitId) ?? null;
  return (
    <span title={code ? `Code ${code}` : undefined} data-testid="unit-label">
      {env.unitName(unitId)}
      {code && <span className="ml-1 text-xs text-muted-foreground">{code}</span>}
    </span>
  );
}
