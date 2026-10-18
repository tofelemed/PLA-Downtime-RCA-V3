import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_CONSEQUENCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Section } from '@/features/ux-kit/page-layout';
import { TEAM_LOCKED_STATUSES } from '../../model/case-workflow';
import { useCaseWorkspace } from '../case-context';

function Fact({ label, value }: { label: string; value: string | null }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value?.trim() || 'Not recorded'}</dd></div>;
}

/** Saved facts on the overview; the existing definition and team editor has its own focused route. */
export function DefinitionSummary() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { search } = useLocation();
  const users = useUserNames();
  const locked = TEAM_LOCKED_STATUSES.includes(rca.status ?? '');
  return <>
    <Section title="Definition" description="Saved investigation facts; changes are made in the definition editor.">
      <dl className="grid gap-4 md:grid-cols-2">
        <Fact label="Consequence class" value={rca.consequenceClass ? labelOf(RCA_CONSEQUENCE_LABELS, rca.consequenceClass) : null} />
        <Fact label="Root cause" value={rca.rootCause} />
        <Fact label="Problem statement" value={rca.description} />
        <Fact label="Team charter" value={rca.teamCharter} />
      </dl>
      {!readOnly && <Button asChild variant="outline" className="mt-4"><Link to={`${basePath}/definition${search}`} data-testid="edit-definition">Edit definition</Link></Button>}
    </Section>
    <Section title="Team" description={locked ? 'The accepted investigation team is fixed until the investigation is reopened.' : undefined}>
      <dl className="grid gap-4 md:grid-cols-2">
        <Fact label="Team lead" value={rca.teamLeadId ? users.nameOf(rca.teamLeadId) : 'No team lead'} />
        <Fact label="Team members" value={rca.teamMemberIds.length ? rca.teamMemberIds.map(users.nameOf).join(', ') : 'No team members yet.'} />
      </dl>
    </Section>
  </>;
}
