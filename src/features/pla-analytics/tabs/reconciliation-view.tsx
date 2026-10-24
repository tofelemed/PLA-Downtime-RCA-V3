import { useSearchParams } from 'react-router-dom';
import type { AnalyticsScope } from '../model/analytics-scope';
import { parsePeriodListFilter } from '../model/period-list';
import { PeriodList } from './period-list';
import { QualityTab } from './quality-tab';
import { ReconciliationTab } from './reconciliation-tab';

/** Reconciliation page ("Inspect" in the filter bar): status counts (a count opens its period list, `?periods=<state>`, UX D-6) or actuals quality. */
export function ReconciliationView({ scope }: { scope: AnalyticsScope }) {
  const [params] = useSearchParams();
  const filter = parsePeriodListFilter(params);
  const status = filter ? <PeriodList scope={scope} filter={filter} /> : <ReconciliationTab scope={scope} />;
  return params.get('inspection') === 'quality' ? <QualityTab scope={scope} /> : status;
}
