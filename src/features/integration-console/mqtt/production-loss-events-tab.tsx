import { Link } from 'react-router-dom';
import { useUnitNames } from '@/features/ux-kit/labels/use-unit-names';
import type { FeedForm } from './model/feeds';

const NOTE = 'Each PLA message becomes a production loss event in the Event Hub: the day’s shortfall of the feed’s unit, with the figures OT declared. Code the reason there; the period accounting reads it from the event.';

/** Event Hub list of the production loss events of one unit (`kinds` and `units` are the list's URL filters). */
export function productionLossEventsHref(unitId: string): string {
  const params = new URLSearchParams({ kinds: 'production_loss' });
  if (unitId) params.set('units', unitId);
  return `/events?${params.toString()}`;
}

/** Where the PLA feeds' messages end up: a link to the production loss events of each feed's unit. */
export function ProductionLossEventsTab({ feeds }: { feeds: readonly FeedForm[] | null }) {
  const { nameOf } = useUnitNames();
  const plaFeeds = (feeds ?? []).filter((feed) => feed.purpose === 'pla');
  return (
    <section className="space-y-3" aria-labelledby="production-loss-events-title" data-testid="production-loss-events">
      <h2 id="production-loss-events-title" className="text-base font-semibold text-heading">Production loss events</h2>
      <p className="text-sm text-muted-foreground">{NOTE}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {plaFeeds.map((feed) => (
          <li key={feed.id}>
            <Link className="underline underline-offset-2" to={productionLossEventsHref(feed.unitId)} data-testid="production-loss-events-link">
              {feed.unitId ? `Production loss events of ${nameOf(feed.unitId)}` : 'Production loss events'}
            </Link>
            <span className="text-muted-foreground"> · feed {feed.id}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
