import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_CONSEQUENCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { CaseFact, CaseFacts } from '../components/case-facts';

/** Saved definition facts on the overview; the definition and team editor has its own focused route. */
export function DefinitionSummary() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { search } = useLocation();
  const edit = readOnly ? null : (
    <Button asChild variant="outline" size="sm">
      <Link to={`${basePath}/definition${search}`} data-testid="edit-definition">
        <ActionIcon.edit aria-hidden="true" className="mr-1 h-4 w-4" />
        Edit definition
      </Link>
    </Button>
  );
  return (
    <CaseCard title="Definition" info="Saved investigation facts; changes are made in the definition editor." actions={edit}>
      <CaseFacts testId="definition-summary">
        <CaseFact label="Consequence class">{rca.consequenceClass ? labelOf(RCA_CONSEQUENCE_LABELS, rca.consequenceClass) : null}</CaseFact>
        <CaseFact label="Problem statement">{rca.description}</CaseFact>
        <CaseFact label="Root cause">{rca.rootCause}</CaseFact>
        <CaseFact label="Team charter">{rca.teamCharter}</CaseFact>
      </CaseFacts>
    </CaseCard>
  );
}
