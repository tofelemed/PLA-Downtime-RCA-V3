import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { EventListCard } from '@/features/event-hub/components/event-list-card';
import { drillEventQuery } from '../model/reason-drill';
import type { DowntimePageProps } from './page-types';

const StateTimeline = lazy(() => import('../components/state-timeline').then((module) => ({ default: module.StateTimeline })));

export function DowntimeStopsPage({ filters }: DowntimePageProps) {
  const [params] = useSearchParams();
  const query = drillEventQuery(filters, null, []);
  delete query.codingStates;
  return (
    <div className="space-y-4" data-testid="downtime-view-stops">
      {params.get('presentation') === 'timeline' ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><StateTimeline filters={filters} /></Suspense>
      ) : (
        <EventListCard title="Stop records" query={query} testId="downtime-stop-list" />
      )}
    </div>
  );
}
