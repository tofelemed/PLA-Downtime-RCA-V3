import { Badge } from '@/components/ui/badge';
import { freshnessOf } from './format/freshness';
import { formatPlantTime, plantTimeParts } from './format/plant-time';

export interface ScopeHeaderProps {
  /** e.g. "HDPE · unit100" */
  scopeLabel: string;
  timezone: string;
  /** true when the zone is the UTC fallback, not the plant's */
  timezoneIsFallback?: boolean;
  /** quantity unit of the figures */
  uom?: string | null;
  /** e.g. "Plan v3 (approved)" */
  baseline?: string | null;
  /** AnalyticsResponse.isProvisional; undefined when the screen shows no ledger figures */
  isProvisional?: boolean;
  /** server time the data was produced (AnalyticsResponse/ListResponse.asOf) */
  asOf?: string | null;
  /** now, for the freshness text (injected for tests) */
  now?: number;
}

/**
 * The standard status line of every analytical screen (UX03): scope, plant timezone with offset, unit,
 * baseline, approved/provisional, as-of and freshness.
 */
export function ScopeHeader(props: ScopeHeaderProps) {
  const { scopeLabel, timezone, uom, baseline, isProvisional, asOf } = props;
  const now = props.now ?? Date.now();
  const offset = plantTimeParts(new Date(now).toISOString(), timezone)?.offset;
  const freshness = freshnessOf(asOf, now);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="scope-header">
      <span className="font-medium">{scopeLabel}</span>
      <Badge variant={props.timezoneIsFallback ? 'destructive' : 'outline'} title={props.timezoneIsFallback ? 'Plant timezone unknown: showing UTC' : undefined}>
        {timezone} {offset ? `(${offset})` : ''}
      </Badge>
      {uom && <Badge variant="outline">Unit: {uom}</Badge>}
      {baseline && <Badge variant="outline">Baseline: {baseline}</Badge>}
      {isProvisional !== undefined && (
        <Badge variant={isProvisional ? 'secondary' : 'default'}>{isProvisional ? 'Provisional' : 'Approved'}</Badge>
      )}
      {asOf && (
        <span className="text-muted-foreground">
          As of {formatPlantTime(asOf, timezone, true)}
          {freshness ? ` · ${freshness}` : ''}
        </span>
      )}
    </div>
  );
}
