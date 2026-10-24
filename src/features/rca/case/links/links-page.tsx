import { LinksTab } from '../../links/links-tab';
import { OutcomePanel } from '../../outcome-panel';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';

const LINKS_INFO =
  'Events, approved loss lines, work orders and occurrences this investigation covers. Work orders are referenced by their number; pushing work to the maintenance system is not available yet.';

/** `/rca/:caseId/links`: what the case is linked to (with evidence packages) and its outcome figures. */
export function LinksPage() {
  const { rca } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  return (
    <div className="space-y-4">
      <CaseCard title="Links" info={LINKS_INFO}>
        <LinksTab rcaId={rca.id} timezone={timezone} closed={rca.status === 'Closed'} />
      </CaseCard>
      <OutcomePanel rcaId={rca.id} />
    </div>
  );
}
