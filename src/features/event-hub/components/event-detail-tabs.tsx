import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProductionEventHistory } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepairEvidencePanel } from '@/features/master-data/reliability/work-orders/repair-evidence-panel';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EvidencePanel } from './evidence-panel';
import { ImpactedPeriodsPreview } from './impacted-periods-preview';
import { ReviewItemsList } from './review-items-list';
import { RevisionTimeline } from './revision-timeline';
import { SourceEffectiveTable } from './source-effective-table';

const TABS = ['details', 'history', 'review', 'evidence', 'repair', 'periods'] as const;
type DetailTab = (typeof TABS)[number];

const tabOf = (value: string | null): DetailTab => (TABS as readonly string[]).includes(value ?? '') ? (value as DetailTab) : 'details';

/** Tabs of the event page (Repair for stops only); the active one is in the URL (`?tab=history`), so Back and links work. */
export function EventDetailTabs({ event }: { event: ProductionEventView }) {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const history = useProductionEventHistory(event.id);
  const data = history.data;
  const isStop = event.classification.physicalType === 'downtime';
  const openReviews = data?.reviewItems.filter((item) => item.state === 'open').length ?? 0;
  const choose = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'details') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true });
  };
  const loaded = (render: () => ReactNode) => (
    <DataState state={dataStateOf(history)} error={history.error} onRetry={() => history.refetch()}>
      {data && render()}
    </DataState>
  );
  return (
    <Tabs value={tab} onValueChange={choose}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="details">Values</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="review">Review ({openReviews})</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
        {isStop && <TabsTrigger value="repair">Repair</TabsTrigger>}
        <TabsTrigger value="periods">Periods</TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        {loaded(() => data && <SourceEffectiveTable revisions={data.revisions} overriddenFields={event.overriddenFields ?? []} />)}
      </TabsContent>
      <TabsContent value="history">{loaded(() => data && <RevisionTimeline history={data} />)}</TabsContent>
      <TabsContent value="review">{loaded(() => data && <ReviewItemsList event={event} items={data.reviewItems} />)}</TabsContent>
      <TabsContent value="evidence">{loaded(() => data && <EvidencePanel history={data} eventId={event.id} />)}</TabsContent>
      {isStop && (
        <TabsContent value="repair">
          <RepairEvidencePanel eventId={event.id} />
        </TabsContent>
      )}
      <TabsContent value="periods">
        <ImpactedPeriodsPreview unitId={event.unitId} from={event.startTime} to={event.endTime ?? event.asOf} />
      </TabsContent>
    </Tabs>
  );
}
