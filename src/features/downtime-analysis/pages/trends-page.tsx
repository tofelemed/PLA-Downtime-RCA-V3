import { useSearchParams } from 'react-router-dom';
import { CalendarComparison } from '../components/calendar-comparison';
import { CrewComparison } from '../components/crew-comparison';
import { TrendPanel } from '../components/trend-panel';
import { pageViews } from '../model/bundle-views';
import type { DowntimePageProps } from './page-types';


export function DowntimeTrendsPage({ filters, bundle }: DowntimePageProps) {
  const [params] = useSearchParams();
  const mode = params.get('comparison');
  return (
    <div className="space-y-4" data-testid="downtime-view-trends">
      {mode === 'crew' ? <CrewComparison bundle={bundle} views={pageViews(filters)} />
        : mode === 'calendar' ? <CalendarComparison filters={filters} bundle={bundle} /> : <TrendPanel filters={filters} bundle={bundle} views={pageViews(filters)} />}
    </div>
  );
}
