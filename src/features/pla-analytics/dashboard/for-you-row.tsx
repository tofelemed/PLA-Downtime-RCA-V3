import type { ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import type { AnalyticsScope } from '../model/analytics-scope';
import { forYouTilesOf, type ForYouTileKey } from './for-you-model';
import { ApprovalsTile, CurrentStopsTile, MyOverdueActionsTile, PeriodsDueTile, RecommendedTile, StopsToCodeTile } from './for-you-tiles';

function tileOf(key: ForYouTileKey, scope: AnalyticsScope): ReactNode {
  switch (key) {
    case 'currentStops':
      return <CurrentStopsTile key={key} scope={scope} />;
    case 'stopsToCode':
      return <StopsToCodeTile key={key} scope={scope} />;
    case 'periodsDue':
      return <PeriodsDueTile key={key} />;
    case 'recommended':
      return <RecommendedTile key={key} />;
    case 'myOverdueActions':
      return <MyOverdueActionsTile key={key} />;
    case 'approvals':
      return <ApprovalsTile key={key} />;
  }
}

/**
 * The dashboard's first row (UX audit §5.6): what the user's roles in the plant ask of them — operators
 * and supervisors their current stops and stops to code, accountants their periods due, reliability
 * engineers recommended investigations and their overdue actions, managers pending approvals. Server
 * figures only; hidden when no role asks for a tile.
 */
export function ForYouRow({ scope }: { scope: AnalyticsScope }) {
  const { roles } = useCapabilities();
  const keys = forYouTilesOf(roles);
  if (keys.length === 0) return null;
  return (
    <Section title="For you">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-for-you">
        {keys.map((key) => tileOf(key, scope))}
      </dl>
    </Section>
  );
}
