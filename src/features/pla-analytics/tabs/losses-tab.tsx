import { useLocation } from 'react-router-dom';
import { Section } from '@/features/ux-kit/page-layout';
import type { AnalyticsScope } from '../model/analytics-scope';
import { LossEvents } from './loss-events';
import { LossTreeTab } from './loss-tree-tab';
import { OpportunitiesTab } from './opportunities-tab';
import { RepeatCausesTab } from './repeat-causes-tab';

export interface LossesTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Losses: the loss tree first; top opportunities, repeat causes and the loss events behind the figures as
 * collapsed sections, each fetched only when it is opened (progressive disclosure, one level of tabs).
 */
export function LossesTab({ scope, onChange }: LossesTabProps) {
  const { hash } = useLocation();
  const opened = (id: string) => hash === `#${id}`;
  return (
    <div className="space-y-6">
      <Section title="Loss tree">
        <LossTreeTab scope={scope} onChange={onChange} />
      </Section>
      <Section title="Top opportunities" collapsible defaultOpen={opened('opportunities')} id="opportunities" description="The largest valued losses by reason, per currency.">
        <OpportunitiesTab scope={scope} onChange={onChange} />
      </Section>
      <Section title="Repeat causes" collapsible defaultOpen={opened('repeat-causes')} id="repeat-causes" description="Stops per reason and asset, with the number of shifts each recurs in.">
        <RepeatCausesTab scope={scope} />
      </Section>
      <Section title="Loss events" collapsible defaultOpen={opened('loss-events')} id="loss-events" description="The stops, slowdowns and quality losses of this scope; open one to see its details.">
        <LossEvents scope={scope} onChange={onChange} />
      </Section>
    </div>
  );
}
