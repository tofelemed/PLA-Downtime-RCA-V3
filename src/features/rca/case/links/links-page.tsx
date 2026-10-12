import { Section } from '@/features/ux-kit/page-layout';
import { LinksTab } from '../../links/links-tab';
import { OutcomePanel } from '../../outcome-panel';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';

/** `/rca/:caseId/links`: what the case is linked to (with evidence packages) and its outcome figures. */
export function LinksPage() {
  const { rca } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  return (
    <>
      <Section title="Links" description="Events, approved loss lines, work orders and occurrences this case investigates.">
        <LinksTab rcaId={rca.id} timezone={timezone} />
      </Section>
      <Section title="Outcome" description="Approved historical loss, claimed avoided loss and realized difference — three separate figures, never added up.">
        <OutcomePanel rcaId={rca.id} />
      </Section>
    </>
  );
}
