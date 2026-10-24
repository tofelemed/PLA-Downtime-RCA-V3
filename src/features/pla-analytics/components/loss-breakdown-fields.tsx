import type { LossTreeGroupBy, LossTreeMetricParam } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { LOSS_EVENT_TYPES, LOSS_GROUPS, VALUE_METRICS, type AnalyticsScope, type LossEventType } from '../model/analytics-scope';
import { LOSS_EVENT_TYPE_LABELS, LOSS_GROUP_LABELS, METRIC_LABELS } from '../model/display';
import { lossMetricsFor, scopeForMoneyAccess } from '../model/money-access';
import { FIELD_CLASS, SELECT_CLASS } from './filter-classes';

export interface LossBreakdownFieldsProps {
  /** the shown breakdown (`tree`, `opportunities`, `repeat-causes`, `loss-events`) */
  breakdown: string;
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

interface FieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labelOf: (value: T) => string;
  onChange: (value: T) => void;
}

function SelectField<T extends string>({ id, label, value, options, labelOf, onChange }: FieldProps<T>) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} data-testid={id} className={SELECT_CLASS} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelOf(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * What the loss breakdown shows, as filter-bar fields after "Explore": the loss tree's grouping and metric,
 * the opportunities' valuation view, or the loss events' type. All sent to the server.
 */
export function LossBreakdownFields({ breakdown, scope, onChange }: LossBreakdownFieldsProps) {
  const { canViewMoney } = useCapabilities();
  if (breakdown === 'tree') {
    return (
      <>
        <SelectField<LossTreeGroupBy> id="loss-group-by" label="Group by" value={scope.lossGroupBy} options={LOSS_GROUPS} labelOf={(g) => LOSS_GROUP_LABELS[g]} onChange={(lossGroupBy) => onChange({ lossGroupBy })} />
        <SelectField<LossTreeMetricParam> id="loss-metric" label="Metric" value={scopeForMoneyAccess(scope, canViewMoney).lossMetric} options={lossMetricsFor(canViewMoney)} labelOf={(m) => METRIC_LABELS[m]} onChange={(lossMetric) => onChange({ lossMetric })} />
      </>
    );
  }
  if (breakdown === 'opportunities') {
    return <SelectField<LossTreeMetricParam> id="value-metric" label="Value" value={scope.valueMetric} options={VALUE_METRICS} labelOf={(m) => METRIC_LABELS[m]} onChange={(valueMetric) => onChange({ valueMetric })} />;
  }
  if (breakdown === 'loss-events') {
    return <SelectField<LossEventType> id="loss-event-type" label="Event type" value={scope.eventType} options={LOSS_EVENT_TYPES} labelOf={(t) => LOSS_EVENT_TYPE_LABELS[t]} onChange={(eventType) => onChange({ eventType })} />;
  }
  return null;
}
